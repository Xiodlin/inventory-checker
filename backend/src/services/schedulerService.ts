import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import type pg from 'pg';
import type { Config } from '../config/environment.js';
import { checkInventory } from '../scrapers/index.js';
import type { InventoryResult } from '../scrapers/baseScraper.js';
import type { Item } from '../database/models/TrackedItem.js';
import type { Notification } from '../database/models/Notification.js';
import type { JsonCache } from './cacheService.js';
import type { Realtime } from './websocketService.js';
import type { PushService } from './notificationService.js';

import { notificationReason } from '@inventory-checker/core';
export { notificationReason } from '@inventory-checker/core';

export class Scheduler {
  private running?: Promise<void>;
  private task?: ReturnType<typeof cron.schedule>;
  private stopped = false;
  constructor(
    private readonly pool: pg.Pool, private readonly cache: JsonCache, private readonly realtime: Realtime,
    private readonly push: PushService, private readonly config: Config,
  ) {}
  start() { this.task = cron.schedule(this.config.CHECK_CRON, () => { void this.tick(); }); }
  tick(): Promise<void> {
    if (this.stopped || this.running) return this.running ?? Promise.resolve();
    this.running = this.checkDue().catch(() => console.warn('Inventory scheduler failed')).finally(() => { this.running = undefined; });
    return this.running;
  }
  private async checkDue() {
    const due = await this.pool.query<Item & { notifications_enabled: boolean }>(`
      SELECT i.*, s.notifications_enabled FROM tracked_items i JOIN settings s ON s.user_id=i.user_id
      WHERE i.last_checked_at IS NULL OR i.last_checked_at <= now() - s.check_interval_minutes * interval '1 minute'
      ORDER BY i.last_checked_at NULLS FIRST LIMIT 500
    `);
    for (const item of due.rows) {
      if (this.stopped) break;
      try {
        const cacheKey = `inventory:v3:${item.retailer}:${item.id}`;
        let result = await this.cache.get<InventoryResult>(cacheKey);
        if (!result) {
          result = await checkInventory(item, this.config.BESTBUY_API_KEY);
          await this.cache.set(cacheKey, result, 60);
        }
        if (item.fulfillment === 'pickup' && !result.pickup_stores) throw new Error('Pickup check did not return store availability');
        await this.persistResult(item, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Inventory check failed';
        const updated = await this.pool.query<Item>(
          'UPDATE tracked_items SET last_checked_at=now(), last_check_error=$1 WHERE id=$2 AND user_id=$3 RETURNING *',
          [message.slice(0, 300), item.id, item.user_id],
        );
        if (updated.rows[0]) this.realtime.broadcast(item.user_id, { type: 'item.updated', item: updated.rows[0] });
      }
    }
  }
  private async persistResult(item: Item, result: InventoryResult) {
    const client = await this.pool.connect();
    let notification: Notification | undefined;
    let updated: Item | undefined;
    try {
      await client.query('BEGIN');
      const locked = await client.query<Item>('SELECT * FROM tracked_items WHERE id=$1 AND user_id=$2 FOR UPDATE', [item.id, item.user_id]);
      const current = locked.rows[0];
      if (!current) { await client.query('COMMIT'); return; }
      const stores = result.pickup_stores ?? [];
      const previousStores = current.pickup_stores ?? [];
      const storesChanged = previousStores.length !== stores.length || stores.some(store =>
        !previousStores.some(previous => previous.id === store.id && previous.available === store.available
          && previous.name === store.name && previous.distance_miles === store.distance_miles));
      updated = (await client.query<Item>(
        'UPDATE tracked_items SET current_price=$1,in_stock=$2,pickup_stores=$3,last_checked_at=now(),last_check_error=NULL WHERE id=$4 RETURNING *',
        [result.price, result.in_stock, JSON.stringify(stores), item.id],
      )).rows[0];
      if (current.current_price !== result.price || current.in_stock !== result.in_stock
          || storesChanged) {
        await client.query('INSERT INTO price_history(id,item_id,price,in_stock,pickup_stores) VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), item.id, result.price, result.in_stock, JSON.stringify(stores)]);
      }
      const preference = await client.query<{ notifications_enabled: boolean }>('SELECT notifications_enabled FROM settings WHERE user_id=$1', [item.user_id]);
      const reason = notificationReason(current, result);
      if (preference.rows[0]?.notifications_enabled && reason) {
        notification = (await client.query<Notification>(
          'INSERT INTO notifications(id,user_id,title,body) VALUES($1,$2,$3,$4) RETURNING id,title,body,read,created_at',
          [randomUUID(), item.user_id, `${item.brand ?? ''} ${item.model ?? item.sku ?? item.retailer}`.trim(), reason],
        )).rows[0];
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
    if (updated) this.realtime.broadcast(item.user_id, { type: 'item.updated', item: updated });
    if (notification) {
      this.realtime.broadcast(item.user_id, { type: 'notification', notification });
      await this.push.send(item.user_id, notification);
    }
  }
  async stop() { this.stopped = true; await this.task?.stop(); await this.running; }
}
