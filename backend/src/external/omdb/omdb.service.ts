import {
  BadGatewayException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { ConcurrencyLimiter } from '../../common/concurrency-limiter';
import { MovieSearchResult } from '../../movies/dto/movie.dtos';
import { SearchMediaType } from '../../movies/dto/search-movies-query.dto';
import { TmdbService } from '../tmdb/tmdb.service';

interface OmdbSearchResponse {
  Search?: Array<{
    Title: string;
    Year: string;
    imdbID: string;
    Poster: string;
    Type: string;
  }>;
  totalResults?: string;
  Response: 'True' | 'False';
  Error?: string;
}

interface OmdbMovieResponse {
  Title: string;
  Year: string;
  imdbID: string;
  Poster: string;
  imdbRating: string;
  Plot: string;
  Type?: string;
  Response: 'True' | 'False';
  Error?: string;
}

export interface NormalizedOmdbMovie {
  imdbId: string;
  title: string;
  year?: string;
  imdbRating?: string;
  plot?: string;
  posterUrl?: string;
}

@Injectable()
export class OmdbService {
  private readonly logger = new Logger(OmdbService.name);
  private readonly client: AxiosInstance;
  private readonly limiter = new ConcurrencyLimiter(
    6,
    100,
    () =>
      new ServiceUnavailableException(
        'Movie data provider is busy. Try again shortly.',
      ),
  );

  constructor(
    private readonly configService: ConfigService,
    private readonly tmdbService: TmdbService,
  ) {
    const baseURL = this.configService.get<string>('omdb.baseUrl');
    this.client = axios.create({
      baseURL,
      timeout: 5000,
      maxRedirects: 0,
      maxContentLength: 2 * 1024 * 1024,
      maxBodyLength: 2 * 1024 * 1024,
    });
  }

  private get apiKey(): string {
    const key = this.configService.get<string>('omdb.apiKey');
    if (!key) {
      throw new InternalServerErrorException(
        'Movie data provider is not configured.',
      );
    }
    return key;
  }

  async searchMovies(
    title: string,
    year?: string,
    type?: SearchMediaType,
  ): Promise<MovieSearchResult[]> {
    const params: Record<string, string> = {
      apikey: this.apiKey,
      s: title,
    };
    if (year) {
      params.y = year;
    }
    if (type) {
      params.type = type;
    }

    const seenIds = new Set<string>();
    const tmdbPriority = new Map<string, number>();
    const aggregated: MovieSearchResult[] = [];

    const MAX_PAGES = 5;
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages && currentPage <= MAX_PAGES) {
      const pageParams = {
        ...params,
        page: currentPage.toString(),
      };
      const data = await this.request<OmdbSearchResponse>(pageParams);

      if (data.Response === 'False') {
        break;
      }

      data.Search?.forEach((item) => {
        if (
          !this.isSupportedType(item.Type, type) ||
          !/^tt\d{7,10}$/.test(item.imdbID)
        ) {
          return;
        }
        if (seenIds.has(item.imdbID)) {
          return;
        }
        seenIds.add(item.imdbID);
        aggregated.push({
          imdbId: item.imdbID,
          title: item.Title,
          year: item.Year,
          posterUrl: this.normalizePoster(item.Poster),
        });
      });

      if (data.totalResults) {
        const parsedTotal = parseInt(data.totalResults, 10);
        if (!Number.isNaN(parsedTotal) && parsedTotal > 0) {
          totalPages = Math.ceil(parsedTotal / 10);
        }
      }

      currentPage += 1;
    }

    const exactMatch = await this.fetchByTitle(title, year, type);
    if (exactMatch && !seenIds.has(exactMatch.imdbId)) {
      aggregated.push(exactMatch);
    }

    if (title.trim()) {
      const tmdbMatches = await this.tmdbService.searchByTitle(title, type, year);
      tmdbMatches.forEach((match, index) => {
        tmdbPriority.set(match.imdbId, index);
        if (seenIds.has(match.imdbId)) {
          return;
        }
        seenIds.add(match.imdbId);
        aggregated.push(match);
      });
    }

    return aggregated
      .filter((item) => !year || item.year?.startsWith(year))
      .sort((a, b) => {
        const priorityA = tmdbPriority.get(a.imdbId) ?? Number.MAX_SAFE_INTEGER;
        const priorityB = tmdbPriority.get(b.imdbId) ?? Number.MAX_SAFE_INTEGER;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        return this.extractYear(b.year) - this.extractYear(a.year);
      });
  }

  async getMovieByImdbId(imdbId: string): Promise<NormalizedOmdbMovie> {
    const params: Record<string, string> = {
      apikey: this.apiKey,
      i: imdbId,
      plot: 'full',
    };

    const data = await this.request<OmdbMovieResponse>(params);

    if (data.Response === 'False') {
      throw new NotFoundException('Movie not found.');
    }

    return {
      imdbId: data.imdbID,
      title: data.Title,
      year: data.Year,
      imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : undefined,
      plot: data.Plot !== 'N/A' ? data.Plot : undefined,
      posterUrl: this.normalizePoster(data.Poster),
    };
  }

  private normalizePoster(poster?: string): string | undefined {
    if (!poster || poster === 'N/A') {
      return undefined;
    }

    try {
      const url = new URL(poster);
      const trustedHost =
        url.hostname === 'image.tmdb.org' ||
        url.hostname.endsWith('.media-amazon.com') ||
        url.hostname.endsWith('.media-imdb.com');
      return url.protocol === 'https:' && trustedHost
        ? url.toString()
        : undefined;
    } catch {
      return undefined;
    }
  }

  private async fetchByTitle(
    title: string,
    year?: string,
    type?: SearchMediaType,
  ): Promise<MovieSearchResult | null> {
    if (!title.trim()) {
      return null;
    }

    const params: Record<string, string> = {
      apikey: this.apiKey,
      t: title,
    };
    if (year) {
      params.y = year;
    }
    if (type) {
      params.type = type;
    }

    const data = await this.request<OmdbMovieResponse>(params);

    if (data.Response === 'False') {
      return null;
    }

    if (!this.isSupportedType(data.Type, type)) {
      return null;
    }

    return {
      imdbId: data.imdbID,
      title: data.Title,
      year: data.Year,
      posterUrl: this.normalizePoster(data.Poster),
    };
  }

  private extractYear(year?: string): number {
    if (!year) {
      return 0;
    }
    const match = year.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : 0;
  }

  private isSupportedType(
    type?: string,
    requestedType?: SearchMediaType,
  ): boolean {
    if (!type) {
      return false;
    }
    const normalized = type.toLowerCase();
    if (requestedType) {
      return normalized === requestedType;
    }
    return (
      normalized === 'movie' ||
      normalized === 'series' ||
      normalized === 'episode'
    );
  }

  private async request<T>(params: Record<string, string>): Promise<T> {
    try {
      return await this.limiter.run(async () => {
        const response = await this.client.get<T>('/', { params });
        return response.data;
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      this.logger.warn(
        status
          ? `OMDb request failed with status ${status}.`
          : 'OMDb request failed.',
      );
      throw new BadGatewayException(
        'Movie data provider is temporarily unavailable.',
      );
    }
  }
}
