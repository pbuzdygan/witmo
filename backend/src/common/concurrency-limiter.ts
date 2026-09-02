type QueueEntry = () => void;

export class ConcurrencyLimiter {
  private activeCount = 0;
  private readonly queue: QueueEntry[] = [];

  constructor(
    private readonly maxConcurrency: number,
    private readonly maxQueueSize: number,
    private readonly queueFullError: () => Error,
  ) {
    if (maxConcurrency < 1 || maxQueueSize < 0) {
      throw new Error('Concurrency limits must be positive.');
    }
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeCount < this.maxConcurrency) {
      return this.execute(task);
    }

    if (this.queue.length >= this.maxQueueSize) {
      return Promise.reject(this.queueFullError());
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        void this.execute(task).then(resolve, reject);
      });
    });
  }

  private async execute<T>(task: () => Promise<T>): Promise<T> {
    this.activeCount += 1;
    try {
      return await task();
    } finally {
      this.activeCount -= 1;
      this.queue.shift()?.();
    }
  }
}
