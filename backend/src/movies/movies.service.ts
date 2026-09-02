import { Injectable } from '@nestjs/common';
import { OmdbService } from '../external/omdb/omdb.service';
import { TmdbService } from '../external/tmdb/tmdb.service';
import { SearchMoviesQueryDto } from './dto/search-movies-query.dto';
import { MovieDetails, MovieSearchResult } from './dto/movie.dtos';
import { TtlCache } from '../common/ttl-cache';

@Injectable()
export class MoviesService {
  private readonly searchCache = new TtlCache<MovieSearchResult[]>(
    5 * 60_000,
    200,
  );
  private readonly detailsCache = new TtlCache<MovieDetails>(15 * 60_000, 100);

  constructor(
    private readonly omdbService: OmdbService,
    private readonly tmdbService: TmdbService,
  ) {}

  async searchMovies(
    query: SearchMoviesQueryDto,
  ): Promise<MovieSearchResult[]> {
    const key = `${query.title.toLocaleLowerCase('en-US')}|${query.year ?? ''}`;
    return this.searchCache.getOrCreate(key, () =>
      this.omdbService.searchMovies(query.title, query.year),
    );
  }

  async getMovieByImdbId(imdbId: string): Promise<MovieDetails> {
    return this.detailsCache.getOrCreate(imdbId, async () => {
      const [omdbMovie, trailerYoutubeKey, watchProviders, collection] =
        await Promise.all([
          this.omdbService.getMovieByImdbId(imdbId),
          this.tmdbService.getYoutubeTrailerKeyByImdbId(imdbId),
          this.tmdbService.getWatchProvidersAvailabilityByImdbId(imdbId),
          this.tmdbService.getCollectionByImdbId(imdbId),
        ]);

      return {
        ...omdbMovie,
        trailerYoutubeKey,
        youtubeSearchUrl: this.buildYoutubeSearchUrl(
          omdbMovie.title,
          omdbMovie.year,
        ),
        watchProviders,
        collection,
      };
    });
  }

  private buildYoutubeSearchUrl(title: string, year?: string): string {
    const query = [title, year, 'trailer'].filter(Boolean).join(' ');
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }
}
