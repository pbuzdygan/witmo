import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  it('deduplicates in-flight work and reuses the resolved value', async () => {
    const cache = new TtlCache<number>(1_000, 10);
    const factory = jest.fn().mockResolvedValue(42);

    const first = cache.getOrCreate('movie', factory);
    const second = cache.getOrCreate('movie', factory);

    await expect(Promise.all([first, second])).resolves.toEqual([42, 42]);
    await expect(cache.getOrCreate('movie', factory)).resolves.toBe(42);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('expires entries and removes rejected promises', async () => {
    let now = 100;
    const cache = new TtlCache<number>(10, 10, () => now);
    const rejectedFactory = jest.fn().mockRejectedValue(new Error('temporary'));

    await expect(cache.getOrCreate('movie', rejectedFactory)).rejects.toThrow(
      'temporary',
    );

    const successfulFactory = jest.fn().mockResolvedValue(1);
    await expect(cache.getOrCreate('movie', successfulFactory)).resolves.toBe(
      1,
    );
    now = 111;
    successfulFactory.mockResolvedValue(2);
    await expect(cache.getOrCreate('movie', successfulFactory)).resolves.toBe(
      2,
    );
    expect(successfulFactory).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest entry when the cache is full', async () => {
    const cache = new TtlCache<number>(1_000, 2);
    await cache.getOrCreate('first', () => Promise.resolve(1));
    await cache.getOrCreate('second', () => Promise.resolve(2));
    await cache.getOrCreate('third', () => Promise.resolve(3));

    const factory = jest.fn().mockResolvedValue(4);
    await expect(cache.getOrCreate('first', factory)).resolves.toBe(4);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
