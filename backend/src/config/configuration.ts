export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '4000', 10),
    trustProxyHops: parseInt(process.env.TRUST_PROXY_HOPS ?? '0', 10),
  },
  security: {
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    rateLimitTtlMs: parseInt(process.env.RATE_LIMIT_TTL_MS ?? '60000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '60', 10),
  },
  omdb: {
    apiKey: process.env.OMDB_API_KEY ?? '',
    baseUrl: 'https://www.omdbapi.com/',
  },
  tmdb: {
    apiKey: process.env.TMDB_API_KEY ?? '',
    readAccessToken: process.env.TMDB_READ_ACCESS_TOKEN ?? '',
    baseUrl: 'https://api.themoviedb.org/3',
  },
  watch: {
    region: process.env.WATCH_REGION ?? 'US',
  },
});
