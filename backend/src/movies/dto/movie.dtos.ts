import type {
  WatchProvidersAvailability,
  CollectionDetails,
} from '../../external/tmdb/tmdb.service';

export interface MovieSearchResult {
  imdbId: string;
  title: string;
  year?: string;
  posterUrl?: string;
}

export interface MovieDetails {
  imdbId: string;
  title: string;
  year?: string;
  imdbRating?: string;
  plot?: string;
  posterUrl?: string;
  trailerYoutubeKey?: string | null;
  youtubeSearchUrl: string;
  watchProviders: WatchProvidersAvailability;
  collection?: CollectionDetails | null;
}
