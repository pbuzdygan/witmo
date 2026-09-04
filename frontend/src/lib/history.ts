import type {
  MovieCollection,
  MovieHistoryEntry,
  MovieSearchResult,
  WatchAvailabilityStatus,
  WatchProvidersAvailability,
} from '@/types/movie';

const MAX_HISTORY_CHARACTERS = 250_000;
const MAX_HISTORY_ENTRIES = 50;
const IMDB_ID_PATTERN = /^tt\d{7,10}$/;
const YOUTUBE_KEY_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const PROVIDER_KEYS = [
  'netflix',
  'primeVideo',
  'appleTv',
  'disneyPlus',
  'hboMax',
  'skyShowtime',
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : undefined;
}

function sanitizePosterUrl(value: unknown): string | undefined {
  const candidate = boundedString(value, 2_048);
  if (!candidate) {
    return undefined;
  }

  try {
    const url = new URL(candidate);
    const trustedHost =
      url.hostname === 'image.tmdb.org' ||
      url.hostname.endsWith('.media-amazon.com') ||
      url.hostname.endsWith('.media-imdb.com');
    return url.protocol === 'https:' && trustedHost ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeSearchResult(value: unknown): MovieSearchResult | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const imdbId = boundedString(record.imdbId, 16);
  const title = boundedString(record.title, 200);
  if (!imdbId || !IMDB_ID_PATTERN.test(imdbId) || !title) {
    return null;
  }

  const result: MovieSearchResult = { imdbId, title };
  const year = boundedString(record.year, 20);
  if (year && /^[0-9–-]{4,20}$/.test(year)) {
    result.year = year;
  }
  const posterUrl = sanitizePosterUrl(record.posterUrl);
  if (posterUrl) {
    result.posterUrl = posterUrl;
  }
  return result;
}

function sanitizeStatus(value: unknown): WatchAvailabilityStatus {
  return value === 'included' || value === 'rent' || value === 'buy' ? value : null;
}

function sanitizeWatchProviders(value: unknown): WatchProvidersAvailability {
  const record = asRecord(value) ?? {};
  const rawRegion = boundedString(record.region, 2)?.toUpperCase();
  const watch: WatchProvidersAvailability = {
    region: rawRegion && /^[A-Z]{2}$/.test(rawRegion) ? rawRegion : 'US',
    netflix: null,
    primeVideo: null,
    appleTv: null,
    disneyPlus: null,
    hboMax: null,
    skyShowtime: null,
  };

  for (const key of PROVIDER_KEYS) {
    watch[key] = sanitizeStatus(record[key]);
  }
  return watch;
}

function sanitizeCollection(value: unknown): MovieCollection | undefined {
  const record = asRecord(value);
  const name = boundedString(record?.name, 200);
  if (!record || !name || !Number.isSafeInteger(record.id) || Number(record.id) < 1) {
    return undefined;
  }

  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems
    .slice(0, 30)
    .map(sanitizeSearchResult)
    .filter((item): item is MovieSearchResult => item !== null);
  if (items.length === 0) {
    return undefined;
  }

  return { id: Number(record.id), name, items };
}

function sanitizeHistoryEntry(value: unknown): MovieHistoryEntry | null {
  const record = asRecord(value);
  const base = sanitizeSearchResult(value);
  if (!record || !base) {
    return null;
  }

  const lastViewedAt = Number(record.lastViewedAt);
  if (!Number.isFinite(lastViewedAt) || lastViewedAt <= 0) {
    return null;
  }

  const searchQuery = [base.title, base.year, 'trailer'].filter(Boolean).join(' ');
  const result: MovieHistoryEntry = {
    ...base,
    lastViewedAt,
    youtubeSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
    watchProviders: sanitizeWatchProviders(record.watchProviders),
  };

  const imdbRating = boundedString(record.imdbRating, 8);
  if (imdbRating && /^\d{1,2}(?:\.\d)?$/.test(imdbRating)) {
    result.imdbRating = imdbRating;
  }
  const plot = boundedString(record.plot, 5_000);
  if (plot) {
    result.plot = plot;
  }
  const trailerYoutubeKey = boundedString(record.trailerYoutubeKey, 20);
  if (trailerYoutubeKey && YOUTUBE_KEY_PATTERN.test(trailerYoutubeKey)) {
    result.trailerYoutubeKey = trailerYoutubeKey;
  }
  const collection = sanitizeCollection(record.collection);
  if (collection) {
    result.collection = collection;
  }

  return result;
}

export function parseMovieHistory(serialized: string): MovieHistoryEntry[] {
  if (serialized.length > MAX_HISTORY_CHARACTERS) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .slice(0, MAX_HISTORY_ENTRIES)
      .map(sanitizeHistoryEntry)
      .filter((entry): entry is MovieHistoryEntry => entry !== null);
  } catch {
    return [];
  }
}

export function serializeMovieHistory(entries: readonly MovieHistoryEntry[]): string {
  const sanitized = entries
    .slice(0, MAX_HISTORY_ENTRIES)
    .map(sanitizeHistoryEntry)
    .filter((entry): entry is MovieHistoryEntry => entry !== null);
  const bounded: MovieHistoryEntry[] = [];

  for (const entry of sanitized) {
    const candidate = [...bounded, entry];
    if (JSON.stringify(candidate).length > MAX_HISTORY_CHARACTERS) {
      break;
    }
    bounded.push(entry);
  }

  return JSON.stringify(bounded);
}
