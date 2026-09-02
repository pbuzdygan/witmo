import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  it('normalizes safe defaults', () => {
    expect(validateEnvironment({})).toMatchObject({
      PORT: 4000,
      WATCH_REGION: 'US',
      CORS_ORIGINS: '',
      RATE_LIMIT_TTL_MS: 60_000,
      RATE_LIMIT_MAX: 60,
      TRUST_PROXY_HOPS: 0,
    });
  });

  it.each([
    [{ PORT: '0' }, 'PORT'],
    [{ WATCH_REGION: '../' }, 'WATCH_REGION'],
    [{ CORS_ORIGINS: '*' }, 'CORS_ORIGINS'],
    [{ CORS_ORIGINS: 'javascript:alert(1)' }, 'CORS_ORIGINS'],
    [{ TRUST_PROXY_HOPS: '-1' }, 'TRUST_PROXY_HOPS'],
  ])('rejects invalid configuration %p', (input, message) => {
    expect(() => validateEnvironment(input)).toThrow(message);
  });

  it('requires provider credentials in production', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      'OMDb credentials',
    );
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        OMDB_API_KEY: 'configured',
      }),
    ).toThrow('TMDb credentials');
  });
});
