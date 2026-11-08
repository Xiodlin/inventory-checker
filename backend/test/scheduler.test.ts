import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationReason, Scheduler } from '../src/services/schedulerService.js';
import type { Item } from '../src/database/models/TrackedItem.js';
import type pg from 'pg';
import type { JsonCache } from '../src/services/cacheService.js';
import type { Realtime } from '../src/services/websocketService.js';
import type { PushService } from '../src/services/notificationService.js';
import type { Config } from '../src/config/environment.js';

const item = { target_price: 100, current_price: 120, in_stock: false, notify_stock: true, notify_price: true } as Item;
test('notifies stock transitions and target crossings without repeating unchanged alerts', () => {
  assert.match(notificationReason(item, { price: 95, in_stock: true })!, /target/);
  assert.match(notificationReason({ ...item, target_price: null }, { price: 120, in_stock: true })!, /back in stock/);
  assert.equal(notificationReason({ ...item, current_price: 95, in_stock: true }, { price: 95, in_stock: true }), null);
  assert.equal(notificationReason(item, { price: 95, in_stock: false }), null);
  assert.match(notificationReason({ ...item, in_stock: null, target_price: null }, { price: 95, in_stock: true })!, /is in stock/);
});
test('stock-only, price-only, and combined subscriptions honor independent choices', () => {
  const stockOnly = { ...item, target_price: null, notify_price: false };
  assert.match(notificationReason(stockOnly, { price: null, in_stock: true })!, /back in stock/);
  assert.equal(notificationReason({ ...stockOnly, in_stock: true }, { price: 50, in_stock: true }), null);
  const priceOnly = { ...item, notify_stock: false };
  assert.equal(notificationReason(priceOnly, { price: 120, in_stock: true }), null);
  assert.equal(notificationReason(priceOnly, { price: null, in_stock: true }), null);
  assert.match(notificationReason(priceOnly, { price: 95, in_stock: true })!, /target/);
  assert.match(notificationReason(item, { price: 95, in_stock: true })!, /back in stock.*target/);
  assert.equal(notificationReason({ ...item, notify_stock: false, notify_price: false }, { price: 95, in_stock: true }), null);
  assert.match(notificationReason({ ...priceOnly, target_price: 0 }, { price: 0, in_stock: true })!, /target/);
});
test('pickup notifications name newly available stores and do not repeat while other stores remain available', () => {
  const first = { id: 'R001', name: 'Nearby Store', distance_miles: 10, available: true };
  const second = { id: 'R002', name: 'Second Store', distance_miles: 50, available: true };
  const pickup: Item = { ...item, fulfillment: 'pickup', target_price: null, notify_price: false, pickup_stores: [], in_stock: null };
  assert.match(notificationReason(pickup, { price: null, in_stock: true, pickup_stores: [first] })!, /pickup at Nearby Store \(10.0 mi\)/);
  assert.equal(notificationReason({ ...pickup, pickup_stores: [first], in_stock: true },
    { price: null, in_stock: true, pickup_stores: [first] }), null);
  const reason = notificationReason({ ...pickup, pickup_stores: [first], in_stock: true },
    { price: null, in_stock: true, pickup_stores: [first, second] });
  assert.match(reason!, /Second Store \(50.0 mi\)/);
  assert.doesNotMatch(reason!, /Nearby Store/);
  assert.equal(notificationReason({ ...pickup, notify_stock: false },
    { price: null, in_stock: true, pickup_stores: [first] }), null);
  assert.match(notificationReason({ ...pickup, notify_stock: false, notify_price: true, target_price: 100 },
    { price: 90, in_stock: true, pickup_stores: [first] })!, /pickup at Nearby Store.*target/);
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
