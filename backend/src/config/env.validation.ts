const DEFAULT_PORT = 4000;
const DEFAULT_RATE_LIMIT_TTL_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 60;
const DEFAULT_WATCH_REGION = 'US';

function parseInteger(
  value: unknown,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

function validateCorsOrigins(value: unknown): string {
  if (value === undefined || value === '') {
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error('CORS_ORIGINS must be a comma-separated list of URLs.');
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGINS contains an invalid URL: ${origin}`);
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin
    ) {
      throw new Error(
        `CORS_ORIGINS must contain absolute HTTP(S) origins: ${origin}`,
      );
    }
  }

  return origins.join(',');
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const output = { ...input };
  const nodeEnv =
    typeof input.NODE_ENV === 'string' ? input.NODE_ENV.trim() : '';
  const watchRegion =
    typeof input.WATCH_REGION === 'string'
      ? input.WATCH_REGION.trim().toUpperCase()
      : DEFAULT_WATCH_REGION;

  if (!/^[A-Z]{2}$/.test(watchRegion)) {
    throw new Error('WATCH_REGION must be a two-letter country code.');
  }

  const omdbKey =
    typeof input.OMDB_API_KEY === 'string' ? input.OMDB_API_KEY.trim() : '';
  const tmdbKey =
    typeof input.TMDB_API_KEY === 'string' ? input.TMDB_API_KEY.trim() : '';
  const tmdbToken =
    typeof input.TMDB_READ_ACCESS_TOKEN === 'string'
      ? input.TMDB_READ_ACCESS_TOKEN.trim()
      : '';

  if (nodeEnv === 'production' && !omdbKey) {
    throw new Error('OMDb credentials are required in production.');
  }
  if (nodeEnv === 'production' && !tmdbKey && !tmdbToken) {
    throw new Error('TMDb credentials are required in production.');
  }

  output.PORT = parseInteger(input.PORT, DEFAULT_PORT, 'PORT', 1, 65_535);
  output.WATCH_REGION = watchRegion;
  output.CORS_ORIGINS = validateCorsOrigins(input.CORS_ORIGINS);
  output.RATE_LIMIT_TTL_MS = parseInteger(
    input.RATE_LIMIT_TTL_MS,
    DEFAULT_RATE_LIMIT_TTL_MS,
    'RATE_LIMIT_TTL_MS',
    1_000,
    3_600_000,
  );
  output.RATE_LIMIT_MAX = parseInteger(
    input.RATE_LIMIT_MAX,
    DEFAULT_RATE_LIMIT_MAX,
    'RATE_LIMIT_MAX',
    1,
    10_000,
  );
  output.TRUST_PROXY_HOPS = parseInteger(
    input.TRUST_PROXY_HOPS,
    0,
    'TRUST_PROXY_HOPS',
    0,
    10,
  );

  return output;
}
