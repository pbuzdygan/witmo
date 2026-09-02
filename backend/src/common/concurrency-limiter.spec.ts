import { ConcurrencyLimiter } from './concurrency-limiter';

describe('ConcurrencyLimiter', () => {
  it('bounds the active work and rejects an overflowing queue', async () => {
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const limiter = new ConcurrencyLimiter(1, 1, () => new Error('queue full'));
    const executionOrder: string[] = [];

    const first = limiter.run(async () => {
      executionOrder.push('first-start');
      await firstGate;
      executionOrder.push('first-end');
      return 1;
    });
    const second = limiter.run(() => {
      executionOrder.push('second');
      return Promise.resolve(2);
    });

    await expect(limiter.run(() => Promise.resolve(3))).rejects.toThrow(
      'queue full',
    );
    expect(executionOrder).toEqual(['first-start']);

    releaseFirst?.();
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(executionOrder).toEqual(['first-start', 'first-end', 'second']);
  });
});
