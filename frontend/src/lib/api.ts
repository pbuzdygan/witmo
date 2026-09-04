import type { MovieDetails, MovieSearchResult } from '@/types/movie';

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

const buildUrl = (path: string, params?: Record<string, string | undefined>): string => {
  const base = API_BASE_PATH.endsWith('/') ? API_BASE_PATH.slice(0, -1) : API_BASE_PATH;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${normalizedPath}`;

  if (!params) {
    return url;
  }

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.append(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `${url}?${queryString}` : url;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let message = 'Failed to fetch data.';
    try {
      const errorBody = await response.json();
      message = errorBody?.message ?? message;
    } catch {
      // noop
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

export const searchMovies = async (
  title: string,
  year?: string,
  type?: 'movie' | 'series',
): Promise<MovieSearchResult[]> => {
  const url = buildUrl('/api/search', { title, year, type });
  const response = await fetch(url, { cache: 'no-store' });
  return handleResponse<MovieSearchResult[]>(response);
};

export const fetchMovieById = async (imdbId: string): Promise<MovieDetails> => {
  const url = buildUrl(`/api/movie/${encodeURIComponent(imdbId)}`);
  const response = await fetch(url, { cache: 'no-store' });
  return handleResponse<MovieDetails>(response);
};
