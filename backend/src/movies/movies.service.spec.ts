import { OmdbService } from '../external/omdb/omdb.service';
import {
  TmdbService,
  WatchProvidersAvailability,
} from '../external/tmdb/tmdb.service';
import { MoviesService } from './movies.service';

describe('MoviesService', () => {
  const watchProviders: WatchProvidersAvailability = {
    region: 'PL',
    netflix: null,
    primeVideo: null,
    appleTv: null,
    disneyPlus: null,
    hboMax: null,
    skyShowtime: null,
  };

  function createService() {
    const omdb = {
      searchMovies: jest
        .fn()
        .mockResolvedValue([
          { imdbId: 'tt0133093', title: 'The Matrix', year: '1999' },
        ]),
      getMovieByImdbId: jest.fn().mockResolvedValue({
        imdbId: 'tt0133093',
        title: 'The Matrix',
        year: '1999',
      }),
    };
    const tmdb = {
      getYoutubeTrailerKeyByImdbId: jest.fn().mockResolvedValue('abcdefghijk'),
      getWatchProvidersAvailabilityByImdbId: jest
        .fn()
        .mockResolvedValue(watchProviders),
      getCollectionByImdbId: jest.fn().mockResolvedValue(null),
    };
    const service = new MoviesService(
      omdb as unknown as OmdbService,
      tmdb as unknown as TmdbService,
    );
    return { service, omdb, tmdb };
  }

  it('deduplicates identical searches', async () => {
    const { service, omdb } = createService();

    await Promise.all([
      service.searchMovies({ title: 'The Matrix', year: '1999' }),
      service.searchMovies({ title: 'the matrix', year: '1999' }),
    ]);

    expect(omdb.searchMovies).toHaveBeenCalledTimes(1);
  });

  it('forwards the selected media type to the provider and keeps it in the cache key', async () => {
    const { service, omdb } = createService();

    await service.searchMovies({ title: 'The Matrix', type: 'movie' });
    await service.searchMovies({ title: 'The Matrix', type: 'series' });

    expect(omdb.searchMovies).toHaveBeenNthCalledWith(
      1,
      'The Matrix',
      undefined,
      'movie',
    );
    expect(omdb.searchMovies).toHaveBeenNthCalledWith(
      2,
      'The Matrix',
      undefined,
      'series',
    );
  });

  it('loads movie providers in parallel and caches the combined response', async () => {
    const { service, omdb, tmdb } = createService();

    const [first, second] = await Promise.all([
      service.getMovieByImdbId('tt0133093'),
      service.getMovieByImdbId('tt0133093'),
    ]);

    expect(first).toEqual(second);
    expect(first.youtubeSearchUrl).toContain('The%20Matrix%201999%20trailer');
    expect(omdb.getMovieByImdbId).toHaveBeenCalledTimes(1);
    expect(tmdb.getYoutubeTrailerKeyByImdbId).toHaveBeenCalledTimes(1);
    expect(tmdb.getWatchProvidersAvailabilityByImdbId).toHaveBeenCalledTimes(1);
    expect(tmdb.getCollectionByImdbId).toHaveBeenCalledTimes(1);
  });
});
