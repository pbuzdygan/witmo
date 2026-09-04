import {
  BadGatewayException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ConcurrencyLimiter } from '../../common/concurrency-limiter';
import { TtlCache } from '../../common/ttl-cache';
import { MovieSearchResult } from '../../movies/dto/movie.dtos';
import { SearchMediaType } from '../../movies/dto/search-movies-query.dto';

interface TmdbFindResponse {
  movie_results?: Array<{
    id: number;
    title: string;
  }>;
  tv_results?: Array<{
    id: number;
    name: string;
  }>;
}

interface TmdbMovieDetailsResponse {
  belongs_to_collection?: {
    id: number;
    name: string;
  } | null;
}

interface TmdbCollectionResponse {
  id: number;
  name: string;
  overview: string;
  parts: Array<{
    id: number;
    title: string;
    release_date?: string;
    poster_path?: string;
  }>;
}

interface TmdbExternalIdsResponse {
  imdb_id?: string | null;
}

interface TmdbVideosResponse {
  results: Array<{
    key: string;
    name: string;
    site: string;
    type: string;
    official?: boolean;
  }>;
}

interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
}

interface TmdbSearchResponse {
  results?: TmdbSearchResult[];
}

interface ProviderEntry {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

interface RegionWatchProviders {
  link?: string;
  flatrate?: ProviderEntry[];
  rent?: ProviderEntry[];
  buy?: ProviderEntry[];
  free?: ProviderEntry[];
}

interface TmdbWatchProvidersResponse {
  results?: Record<string, RegionWatchProviders>;
}

type ProviderKey =
  | 'netflix'
  | 'primeVideo'
  | 'appleTv'
  | 'disneyPlus'
  | 'hboMax'
  | 'skyShowtime';

interface ProviderMatchConfig {
  ids: number[];
  names: string[];
}

const WATCH_PROVIDER_SOURCES: Record<ProviderKey, ProviderMatchConfig> = {
  netflix: {
    ids: [8],
    names: ['Netflix'],
  },
  primeVideo: {
    ids: [9, 10, 119, 512],
    names: ['Amazon Prime Video', 'Amazon Prime', 'Amazon Video'],
  },
  appleTv: {
    ids: [2, 350, 376],
    names: ['Apple TV Plus', 'Apple TV+', 'Apple TV', 'Apple iTunes'],
  },
  disneyPlus: {
    ids: [337],
    names: ['Disney Plus', 'Disney+'],
  },
  hboMax: {
    ids: [384, 1007],
    names: ['HBO Max', 'Max'],
  },
  skyShowtime: {
    ids: [675],
    names: ['SkyShowtime'],
  },
};

export type WatchAvailabilityStatus = 'included' | 'rent' | 'buy' | null;

export interface WatchProvidersAvailability {
  region: string;
  netflix: WatchAvailabilityStatus;
  primeVideo: WatchAvailabilityStatus;
  appleTv: WatchAvailabilityStatus;
  disneyPlus: WatchAvailabilityStatus;
  hboMax: WatchAvailabilityStatus;
  skyShowtime: WatchAvailabilityStatus;
}

export interface CollectionItem {
  imdbId: string;
  title: string;
  year?: string;
  posterUrl?: string;
}

export interface CollectionDetails {
  id: number;
  name: string;
  items: CollectionItem[];
}

type TmdbMediaType = 'movie' | 'tv';
type TmdbMedia = { id: number; type: TmdbMediaType };

@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);
  private readonly client: AxiosInstance;
  private readonly limiter = new ConcurrencyLimiter(
    10,
    150,
    () =>
      new ServiceUnavailableException(
        'Movie data provider is busy. Try again shortly.',
      ),
  );
  private readonly mediaCache = new TtlCache<TmdbMedia | null>(
    15 * 60_000,
    500,
  );
  private readonly externalIdCache = new TtlCache<string | null>(
    30 * 60_000,
    1_000,
  );

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get<string>('tmdb.baseUrl');
    this.client = axios.create({
      baseURL,
      timeout: 5000,
      maxRedirects: 0,
      maxContentLength: 2 * 1024 * 1024,
      maxBodyLength: 2 * 1024 * 1024,
    });
  }

  private get apiKey(): string | null {
    const key = this.configService.get<string>('tmdb.apiKey');
    return key ?? null;
  }

  private get readAccessToken(): string | null {
    const token = this.configService.get<string>('tmdb.readAccessToken');
    return token ? token.trim() : null;
  }

  private get watchRegion(): string {
    return (
      this.configService.get<string>('watch.region') ?? 'US'
    ).toUpperCase();
  }

  private ensureAuthAvailable(): void {
    if (!this.apiKey && !this.readAccessToken) {
      throw new InternalServerErrorException(
        'Movie data provider is not configured.',
      );
    }
  }

  async getYoutubeTrailerKeyByImdbId(imdbId: string): Promise<string | null> {
    this.ensureAuthAvailable();
    const media = await this.findMediaByImdbId(imdbId);
    if (!media) {
      return null;
    }

    const path =
      media.type === 'movie'
        ? `/movie/${media.id}/videos`
        : `/tv/${media.id}/videos`;
    const data = await this.request<TmdbVideosResponse>(
      path,
      this.buildRequestConfig(),
    );

    if (!data.results?.length) {
      return null;
    }

    const officialTrailer =
      data.results.find(
        (video) =>
          video.site === 'YouTube' &&
          video.type === 'Trailer' &&
          (video.official ?? false),
      ) ??
      data.results.find(
        (video) => video.site === 'YouTube' && video.type === 'Trailer',
      ) ??
      data.results.find((video) => video.site === 'YouTube');

    const key = officialTrailer?.key;
    return key && /^[A-Za-z0-9_-]{6,20}$/.test(key) ? key : null;
  }

  private async findMediaByImdbId(imdbId: string): Promise<TmdbMedia | null> {
    return this.mediaCache.getOrCreate(imdbId, async () => {
      const config = this.buildRequestConfig({ external_source: 'imdb_id' });
      const data = await this.request<TmdbFindResponse>(
        `/find/${imdbId}`,
        config,
      );

      if (data.movie_results?.length) {
        return { id: data.movie_results[0].id, type: 'movie' };
      }

      if (data.tv_results?.length) {
        return { id: data.tv_results[0].id, type: 'tv' };
      }

      return null;
    });
  }

  private buildRequestConfig(params: Record<string, string> = {}) {
    const token = this.readAccessToken;
    if (token) {
      return {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
    }

    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'Movie data provider is not configured.',
      );
    }

    return {
      params: {
        ...params,
        api_key: this.apiKey,
      },
    };
  }

  async getWatchProvidersAvailabilityByImdbId(
    imdbId: string,
  ): Promise<WatchProvidersAvailability> {
    this.ensureAuthAvailable();
    const media = await this.findMediaByImdbId(imdbId);

    if (!media) {
      return this.emptyWatchAvailability();
    }

    const endpoint =
      media.type === 'movie'
        ? `/movie/${media.id}/watch/providers`
        : `/tv/${media.id}/watch/providers`;
    const data = await this.request<TmdbWatchProvidersResponse>(
      endpoint,
      this.buildRequestConfig(),
    );

    const regionData =
      data.results?.[this.watchRegion] ??
      data.results?.[this.watchRegion.toUpperCase()] ??
      data.results?.US;

    return {
      region: this.watchRegion,
      netflix: this.resolveProviderStatus(
        regionData,
        WATCH_PROVIDER_SOURCES.netflix,
      ),
      primeVideo: this.resolveProviderStatus(
        regionData,
        WATCH_PROVIDER_SOURCES.primeVideo,
      ),
      appleTv: this.resolveProviderStatus(
        regionData,
        WATCH_PROVIDER_SOURCES.appleTv,
      ),
      disneyPlus: this.resolveProviderStatus(
        regionData,
        WATCH_PROVIDER_SOURCES.disneyPlus,
      ),
      hboMax: this.resolveProviderStatus(
        regionData,
        WATCH_PROVIDER_SOURCES.hboMax,
      ),
      skyShowtime: this.resolveProviderStatus(
        regionData,
        WATCH_PROVIDER_SOURCES.skyShowtime,
      ),
    };
  }

  async searchByTitle(
    title: string,
    requestedType?: SearchMediaType,
    year?: string,
    limitPerType = 20,
  ): Promise<MovieSearchResult[]> {
    if (!title.trim()) {
      return [];
    }

    const mediaTypes: TmdbMediaType[] =
      requestedType === 'movie'
        ? ['movie']
        : requestedType === 'series'
          ? ['tv']
          : ['movie', 'tv'];
    const resultSets = await Promise.all(
      mediaTypes.map((type) => this.fetchSearchResults(type, title, year)),
    );

    const combined: MovieSearchResult[] = [];
    const seen = new Set<string>();

    const processEntries = async (
      entries: TmdbSearchResult[],
      type: TmdbMediaType,
    ) => {
      const normalized = await Promise.all(
        entries.slice(0, limitPerType).map(async (entry) => {
          const imdbId = await this.getExternalIdsByTmdbId(entry.id, type);
          if (!imdbId) {
            return null;
          }
          return {
            imdbId,
            title: entry.title ?? entry.name ?? title,
            year: this.extractYearFromTmdb(entry, type),
            posterUrl: this.buildPosterUrl(entry.poster_path),
          } satisfies MovieSearchResult;
        }),
      );

      for (const entry of normalized) {
        if (!entry || seen.has(entry.imdbId)) {
          continue;
        }
        seen.add(entry.imdbId);
        combined.push(entry);
      }
    };

    for (const [index, entries] of resultSets.entries()) {
      await processEntries(entries, mediaTypes[index]);
    }

    return combined;
  }

  private resolveProviderStatus(
    regionData: RegionWatchProviders | undefined,
    provider: ProviderMatchConfig,
  ): WatchAvailabilityStatus {
    if (!regionData) {
      return null;
    }

    if (
      regionData.flatrate?.some((entry) =>
        this.matchesProvider(entry, provider),
      )
    ) {
      return 'included';
    }
    if (
      regionData.rent?.some((entry) => this.matchesProvider(entry, provider))
    ) {
      return 'rent';
    }
    if (
      regionData.buy?.some((entry) => this.matchesProvider(entry, provider))
    ) {
      return 'buy';
    }
    return null;
  }

  private matchesProvider(
    entry: ProviderEntry,
    match: ProviderMatchConfig,
  ): boolean {
    if (match.ids.includes(entry.provider_id)) {
      return true;
    }
    return match.names.some(
      (name) => name.toLowerCase() === entry.provider_name.toLowerCase().trim(),
    );
  }

  private emptyWatchAvailability(): WatchProvidersAvailability {
    return {
      region: this.watchRegion,
      netflix: null,
      primeVideo: null,
      appleTv: null,
      disneyPlus: null,
      hboMax: null,
      skyShowtime: null,
    };
  }

  async getCollectionByImdbId(
    imdbId: string,
  ): Promise<CollectionDetails | null> {
    this.ensureAuthAvailable();
    const media = await this.findMediaByImdbId(imdbId);

    if (!media || media.type !== 'movie') {
      return null;
    }

    const movieDetails = await this.request<TmdbMovieDetailsResponse>(
      `/movie/${media.id}`,
      this.buildRequestConfig(),
    );

    if (!movieDetails.belongs_to_collection?.id) {
      return null;
    }

    const collectionId = movieDetails.belongs_to_collection.id;
    const data = await this.request<TmdbCollectionResponse>(
      `/collection/${collectionId}`,
      this.buildRequestConfig(),
    );

    const items = (
      await Promise.all(
        data.parts.slice(0, 30).map(async (part) => {
          const partImdbId = await this.getExternalIdsByTmdbId(
            part.id,
            'movie',
          );
          if (!partImdbId) {
            return null;
          }

          const normalized: CollectionItem = {
            imdbId: partImdbId,
            title: part.title,
          };

          if (part.release_date) {
            normalized.year = part.release_date.slice(0, 4);
          }

          if (part.poster_path) {
            normalized.posterUrl = `https://image.tmdb.org/t/p/w500${part.poster_path}`;
          }

          return normalized;
        }),
      )
    ).filter((item): item is CollectionItem => item !== null);

    if (!items.length) {
      return null;
    }

    items.sort((a, b) => {
      const yearA = a.year ? parseInt(a.year, 10) : 0;
      const yearB = b.year ? parseInt(b.year, 10) : 0;
      return yearB - yearA;
    });

    return {
      id: data.id,
      name: data.name,
      items,
    };
  }

  async getExternalIdsByTmdbId(
    tmdbId: number,
    type: TmdbMediaType = 'movie',
  ): Promise<string | null> {
    const cacheKey = `${type}:${tmdbId}`;
    return this.externalIdCache.getOrCreate(cacheKey, async () => {
      const endpoint =
        type === 'movie'
          ? `/movie/${tmdbId}/external_ids`
          : `/tv/${tmdbId}/external_ids`;
      const data = await this.request<TmdbExternalIdsResponse>(
        endpoint,
        this.buildRequestConfig(),
      );
      const imdbId = data.imdb_id;
      return imdbId && /^tt\d{7,10}$/.test(imdbId) ? imdbId : null;
    });
  }

  private async fetchSearchResults(
    type: TmdbMediaType,
    title: string,
    year?: string,
  ): Promise<TmdbSearchResult[]> {
    const endpoint = type === 'movie' ? '/search/movie' : '/search/tv';
    const params: Record<string, string> = {
      query: title,
      include_adult: 'false',
      page: '1',
    };
    if (year) {
      params[type === 'movie' ? 'primary_release_year' : 'first_air_date_year'] =
        year;
    }
    const config = this.buildRequestConfig(params);
    const data = await this.request<TmdbSearchResponse>(endpoint, config);
    return data.results ?? [];
  }

  private extractYearFromTmdb(
    result: TmdbSearchResult,
    type: TmdbMediaType,
  ): string | undefined {
    const date =
      type === 'movie'
        ? result.release_date
        : (result.first_air_date ?? result.release_date);
    return date?.slice(0, 4);
  }

  private buildPosterUrl(path?: string): string | undefined {
    if (!path) {
      return undefined;
    }
    return `https://image.tmdb.org/t/p/w500${path}`;
  }

  private async request<T>(
    path: string,
    config: AxiosRequestConfig,
  ): Promise<T> {
    try {
      return await this.limiter.run(async () => {
        const response = await this.client.get<T>(path, config);
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
          ? `TMDb request failed with status ${status}.`
          : 'TMDb request failed.',
      );
      throw new BadGatewayException(
        'Movie data provider is temporarily unavailable.',
      );
    }
  }
}
