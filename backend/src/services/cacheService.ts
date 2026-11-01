import { createClient } from 'redis';
export class JsonCache {
  readonly client: ReturnType<typeof createClient>;
  constructor(url: string) {
    this.client = createClient({ url, socket: { connectTimeout: 5000, reconnectStrategy: false } });
    this.client.on('error', () => console.warn('Redis connection error'));
  }
  async connect() { await this.client.connect(); }
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value === null ? null : JSON.parse(value) as T;
    } catch { return null; }
  }
  async set(key: string, value: unknown, ttlSeconds: number) {
    try { await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds }); }
    catch { console.warn('Redis cache write failed'); }
  }
  async close() { if (this.client.isOpen) await this.client.quit(); }
}
