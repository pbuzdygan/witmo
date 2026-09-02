export interface MovieSearchResult {
  imdbId: string;
  title: string;
  year?: string;
  posterUrl?: string;
}

export interface MovieDetails extends MovieSearchResult {
  imdbRating?: string;
  plot?: string;
  trailerYoutubeKey?: string | null;
  youtubeSearchUrl: string;
  watchProviders: WatchProvidersAvailability;
  collection?: MovieCollection | null;
}

export interface MovieHistoryEntry extends MovieDetails {
  lastViewedAt: number;
}

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

export interface MovieCollection {
  id: number;
  name: string;
  items: MovieSearchResult[];
}
