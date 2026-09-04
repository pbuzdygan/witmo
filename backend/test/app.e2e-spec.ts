import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApplication } from './../src/app.setup';
import { MoviesService } from './../src/movies/movies.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MoviesService)
      .useValue({
        searchMovies: jest.fn().mockResolvedValue([]),
        getMovieByImdbId: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app, app.get(ConfigService));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api (GET) exposes only the intended status', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('WITMO API is running');
  });

  it('/api/health (GET) supports container health checks', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('sets security headers and hides framework information', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers['cache-control']).toBe('no-store, max-age=0');
    expect(response.headers.pragma).toBe('no-cache');
    expect(response.headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it.each([
    ['/api/search', 'missing title'],
    ['/api/search?title=%20%20%20', 'blank title'],
    ['/api/search?title=Alien&year=20xx', 'invalid year'],
    ['/api/search?title=Alien&type=documentary', 'invalid media type'],
    ['/api/search?title=Alien&unexpected=true', 'unknown query field'],
    ['/api/movie/not-an-imdb-id', 'invalid IMDb id'],
  ])('rejects %s (%s)', (path) => {
    return request(app.getHttpServer()).get(path).expect(400);
  });

  it('rate limits the expensive search endpoint', async () => {
    for (let requestNumber = 0; requestNumber < 10; requestNumber += 1) {
      await request(app.getHttpServer())
        .get('/api/search?title=Alien')
        .expect(200);
    }
    await request(app.getHttpServer())
      .get('/api/search?title=Alien')
      .expect(429);
  });
});
