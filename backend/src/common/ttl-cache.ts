interface CacheEntry<T> {
  expiresAt: number;
  value: Promise<T>;
}

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {
    if (ttlMs < 1 || maxEntries < 1) {
      throw new Error('Cache limits must be positive.');
    }
  }

  getOrCreate(key: string, factory: () => Promise<T>): Promise<T> {
    const timestamp = this.now();
    this.removeExpired(timestamp);

    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > timestamp) {
      return cached.value;
    }

    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }

    const value = Promise.resolve().then(factory);
    this.entries.set(key, {
      expiresAt: timestamp + this.ttlMs,
      value,
    });

    void value.catch(() => {
      if (this.entries.get(key)?.value === value) {
        this.entries.delete(key);
      }
    });

    return value;
  }

  clear(): void {
    this.entries.clear();
  }

  private removeExpired(timestamp: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= timestamp) {
        this.entries.delete(key);
      }
    }
  }
}
