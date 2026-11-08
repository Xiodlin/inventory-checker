import { z } from 'zod';
import { shoppingInput, type ShoppingInput, type ShoppingSearch } from './shopping';
import type { LocalStore } from './localStore';

export interface ShoppingWatch {
  id: string; input: ShoppingInput; enabled: boolean;
  last_checked_at: string | null; error: string | null; result: ShoppingSearch | null;
}
type WatchRow = { id: string; input: string; enabled: number; last_checked_at: string | null;
  error: string | null; result: string | null; stock: string };
const offerKey = (offer: ShoppingSearch['offers'][number]) =>
  `${offer.title.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${offer.seller.toLowerCase().trim()}`;

export class ShoppingMonitor {
  private running?: Promise<void>;
  private manual?: Promise<void>;
  private generation = 0;
  constructor(private readonly store: LocalStore, private readonly uuid: () => string,
    private readonly search: (input: ShoppingInput) => Promise<ShoppingSearch>,
    private readonly changed: () => void, private readonly now = Date.now) {}
  private async initialize() {
    await this.store.db.exec(`CREATE TABLE IF NOT EXISTS shopping_watches (
      id TEXT PRIMARY KEY, input TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1,
      last_checked_at TEXT, error TEXT, result TEXT, stock TEXT NOT NULL DEFAULT '[]'
    )`);
  }
  async watches(): Promise<ShoppingWatch[]> {
    await this.initialize();
    return (await this.store.db.all<WatchRow>('SELECT * FROM shopping_watches ORDER BY id')).map(row => ({
      id: row.id, input: shoppingInput.parse(JSON.parse(row.input)), enabled: row.enabled === 1,
      last_checked_at: row.last_checked_at, error: row.error,
      result: row.result ? JSON.parse(row.result) as ShoppingSearch : null,
    }));
  }
  async save(input: unknown) {
    const parsed = shoppingInput.parse(input);
    const value = JSON.stringify({ ...parsed, variants: [...new Set(parsed.variants)].sort() });
    await this.initialize();
    await this.store.db.run('INSERT INTO shopping_watches(id,input) VALUES(?,?) ON CONFLICT(input) DO UPDATE SET enabled=1',
      [this.uuid(), value]);
    this.changed();
  }
  async remove(id: string) {
    z.string().uuid().parse(id);
    await this.initialize();
    await this.store.db.run('DELETE FROM shopping_watches WHERE id=?', [id]);
    this.changed();
  }
  tick() {
    if (this.manual) return this.manual;
    if (this.running) return this.running;
    const generation = this.generation;
    this.running = this.run(generation).finally(() => { this.running = undefined; });
    return this.running;
  }
  checkNow() {
    if (this.manual) return this.manual;
    const generation = this.generation;
    this.manual = (async () => {
      if (this.running) await this.running;
      if (generation !== this.generation) return;
      this.running = (async () => {
        for (const watch of await this.watches()) {
          if (generation !== this.generation) break;
          if (watch.enabled) await this.run(generation, watch.id);
        }
      })().finally(() => { this.running = undefined; });
      await this.running;
    })().finally(() => { this.manual = undefined; });
    return this.manual;
  }
  private async run(generation: number, forceId?: string) {
    const settings = await this.store.settings();
    if (!forceId && !settings.background_enabled) return;
    const watch = (await this.watches()).filter(value => value.enabled && (forceId ? value.id === forceId : (!value.last_checked_at
      || Date.parse(value.last_checked_at) <= this.now() - settings.check_interval_minutes * 60000)))
      .sort((a, b) => (a.last_checked_at ?? '').localeCompare(b.last_checked_at ?? ''))[0];
    if (!watch || generation !== this.generation) return;
    let result: ShoppingSearch | undefined;
    let error: string | null = null;
    try { result = await this.search(watch.input); error = result.error; }
    catch (failure) {
      error = failure instanceof Error ? failure.message : 'Shopping check failed';
      console.warn('Saved shopping check failed:', error);
    }
    if (generation !== this.generation) return;
    await this.store.db.transaction(async tx => {
      const row = (await tx.all<WatchRow>('SELECT * FROM shopping_watches WHERE id=?', [watch.id]))[0];
      if (!row) return;
      const time = new Date(this.now()).toISOString();
      if (error || !result) {
        await tx.run('UPDATE shopping_watches SET last_checked_at=?,error=? WHERE id=?',
          [time, (error ?? 'Shopping check returned no result').slice(0, 500), watch.id]);
        return;
      }
      const previous = z.array(z.string()).parse(JSON.parse(row.stock));
      const available = result.offers.filter(offer => offer.match === 'text-match' && offer.availability === 'reported-in-stock'
        && !(offer.verification?.status === 'verified' && offer.verification.in_stock === false));
      const unknown = result.offers.filter(offer => offer.match === 'text-match' && offer.availability === 'unknown').map(offerKey);
      const stock = [...new Set([...available.map(offerKey), ...previous.filter(key => unknown.includes(key))])];
      const fresh = available.filter((offer, index) => !previous.includes(offerKey(offer))
        && available.findIndex(other => offerKey(other) === offerKey(offer)) === index);
      if (fresh.length) {
        await tx.run('INSERT INTO notifications(id,title,body,created_at) VALUES(?,?,?,?)',
          [this.uuid(), `Google reports stock: ${watch.input.product}`,
            fresh.slice(0, 5).map(offer => `${offer.title} — ${offer.seller} · ${offer.price} · ${offer.availability_text}`).join('\n')
              + '\nGoogle-reported, not retailer-verified. Open watchlist details to review.', time]);
      }
      await tx.run('UPDATE shopping_watches SET last_checked_at=?,error=NULL,result=?,stock=? WHERE id=?',
        [time, JSON.stringify(result), JSON.stringify(stock), watch.id]);
    });
    this.changed();
  }
  cancel() { this.generation++; }
  async stop() { this.cancel(); await this.running; await this.manual; }
}
