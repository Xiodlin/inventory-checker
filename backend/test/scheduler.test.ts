import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationReason, Scheduler } from '../src/services/schedulerService.js';
import type { Item } from '../src/database/models/TrackedItem.js';
import type pg from 'pg';
import type { JsonCache } from '../src/services/cacheService.js';
import type { Realtime } from '../src/services/websocketService.js';
import type { PushService } from '../src/services/notificationService.js';
import type { Config } from '../src/config/environment.js';

const item = { target_price: 100, current_price: 120, in_stock: false } as Item;
test('notifies stock transitions and target crossings without repeating unchanged alerts', () => {
  assert.match(notificationReason(item, { price: 95, in_stock: true })!, /target/);
  assert.match(notificationReason({ ...item, target_price: null }, { price: 120, in_stock: true })!, /back in stock/);
  assert.equal(notificationReason({ ...item, current_price: 95, in_stock: true }, { price: 95, in_stock: true }), null);
  assert.equal(notificationReason(item, { price: 95, in_stock: false }), null);
  assert.equal(notificationReason({ ...item, in_stock: null, target_price: null }, { price: 95, in_stock: true }), null);
});
test('scheduler prevents overlapping runs and respects per-user interval SQL', async () => {
  let queries = 0;
  let resolve!: (value: { rows: [] }) => void;
  const pool = { query: async (sql: string) => {
    assert.match(sql, /s\.check_interval_minutes/);
    queries++;
    return await new Promise<{ rows: [] }>(r => { resolve = r; });
  } } as unknown as pg.Pool;
  const scheduler = new Scheduler(pool, {} as JsonCache, {} as Realtime, {} as PushService, {} as Config);
  const first = scheduler.tick();
  const second = scheduler.tick();
  assert.equal(first, second);
  assert.equal(queries, 1);
  resolve({ rows: [] });
  await first;
  await scheduler.stop();
  await scheduler.tick();
  assert.equal(queries, 1);
});
