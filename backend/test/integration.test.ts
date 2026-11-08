import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createPool } from '../src/database/connection.js';
import { migrate } from '../src/database/migrationRunner.js';
import { parseConfig } from '../src/config/environment.js';
import { Scheduler } from '../src/services/schedulerService.js';
import type { JsonCache } from '../src/services/cacheService.js';
import type { Realtime } from '../src/services/websocketService.js';
import type { PushService } from '../src/services/notificationService.js';
import type { InventoryResult } from '../src/scrapers/baseScraper.js';
import type { Item } from '../src/database/models/TrackedItem.js';

test('Apple pickup API, store snapshots, restock alerts, and failed checks persist without shipping fallback', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const config = parseConfig({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    REDIS_URL: 'redis://localhost', JWT_SECRET: randomBytes(32).toString('hex'),
  });
  const pool = createPool(config);
  await migrate(pool);
  const server = createServer(createApp(pool, config));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  let owner: string | undefined;
  let scheduler: Scheduler | undefined;
  try {
    const registration = await fetch(`${base}/api/users/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `${randomUUID()}@example.com`, password: 'pickup-fixture-password' }),
    });
    const account = await registration.json() as { token: string; user: { id: string } };
    owner = account.user.id;
    const headers = { 'content-type': 'application/json', authorization: ['Bearer', account.token].join(' ') };
    const created = await fetch(`${base}/api/items`, {
      method: 'POST', headers, body: JSON.stringify({
        retailer: 'apple', url: 'https://www.apple.com/shop/buy-iphone/iphone-duo/7.6-inch-display-256gb-night-sky-att',
        fulfillment: 'pickup', pickup_zip: '02108', notify_stock: true, notify_price: false,
      }),
    });
    assert.equal(created.status, 201);
    const item = await created.json() as Item;
    assert.equal(item.pickup_zip, '02108');
    assert.equal(item.pickup_radius_miles, 50);
    assert.equal(item.fulfillment, 'pickup');
    assert.deepEqual(item.pickup_stores, []);
    const first = { id: 'R001', name: 'Nearby Store', distance_miles: 5, available: false };
    const second = { id: 'R002', name: 'Second Store', distance_miles: 50, available: false };
    let sample: InventoryResult = { price: 1999, in_stock: false, pickup_stores: [first, second] };
    let failure = false;
    const events: { type: string }[] = [];
    scheduler = new Scheduler(pool, {
      get: async () => {
        if (failure) throw new Error('Apple pickup returned HTTP 541; availability is unknown');
        return sample;
      }, set: async () => {},
    } as unknown as JsonCache,
    { broadcast: (_owner: string, event: { type: string }) => events.push(event) } as unknown as Realtime,
    { send: async () => {} } as unknown as PushService, config);
    const check = async () => {
      await pool.query("UPDATE tracked_items SET last_checked_at=NULL WHERE id=$1", [item.id]);
      await scheduler!.tick();
    };
    const alerts = async () => (await pool.query<{ body: string }>('SELECT body FROM notifications WHERE user_id=$1 ORDER BY created_at', [owner])).rows;
    await check();
    assert.equal((await alerts()).length, 0);
    sample = { price: 1999, in_stock: true, pickup_stores: [{ ...first, available: true }, second] };
    await check();
    assert.match((await alerts())[0].body, /Nearby Store \(5.0 mi\)/);
    await check();
    assert.equal((await alerts()).length, 1);
    sample = { price: 1999, in_stock: true, pickup_stores: [{ ...first, available: true }, { ...second, available: true }] };
    await check();
    assert.equal((await alerts()).length, 2, 'new store should alert even while another remains in stock');
    assert.match((await alerts())[1].body, /Second Store \(50.0 mi\)/);
    const history = await (await fetch(`${base}/api/items/${item.id}/prices`, { headers })).json() as { pickup_stores: Item['pickup_stores'] }[];
    assert.equal(history.length, 3);
    assert.deepEqual(history[0].pickup_stores, sample.pickup_stores);
    failure = true;
    await check();
    const failed = await (await fetch(`${base}/api/items/${item.id}`, { headers })).json() as Item;
    assert.equal(failed.in_stock, true, 'failure must preserve last known pickup state');
    assert.deepEqual(failed.pickup_stores, sample.pickup_stores);
    assert.match(failed.last_check_error!, /541/);
    assert.equal((await alerts()).length, 2);
    assert.ok(events.some(event => event.type === 'item.updated'));
    assert.equal(events.filter(event => event.type === 'notification').length, 2);
  } finally {
    await scheduler?.stop();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (owner) await pool.query('DELETE FROM users WHERE id=$1', [owner]);
    await pool.end();
  }
});

test('PostgreSQL migrations, API lifecycle, ownership, and scheduled alerts', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const config = parseConfig({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    REDIS_URL: 'redis://localhost', JWT_SECRET: randomBytes(32).toString('hex'),
  });
  const pool = createPool(config);
  await Promise.all([migrate(pool), migrate(pool)]);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 3);
  const server = createServer(createApp(pool, config));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const users: string[] = [];
  const request = async (path: string, method = 'GET', body?: unknown, token?: string) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = ['Bearer', token].join(' ');
    return fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  };
  try {
    const email = `${randomUUID()}@example.com`;
    const registration = await request('/api/users/register', 'POST', { email, password: 'test-password-long' });
    assert.equal(registration.status, 201);
    const account = await registration.json() as { token: string; user: { id: string } };
    users.push(account.user.id);
    assert.equal((await request('/api/users/register', 'POST', { email, password: 'test-password-long' })).status, 409);
    assert.equal((await request('/api/users/login', 'POST', { email, password: 'wrong-password' })).status, 401);
    assert.equal((await request('/api/users/login', 'POST', { email, password: 'test-password-long' })).status, 200);
    const second = await (await request('/api/users/register', 'POST', { email: `${randomUUID()}@example.com`, password: 'test-password-long' })).json() as typeof account;
    users.push(second.user.id);
    assert.equal((await (await request('/api/users/me', 'GET', undefined, account.token)).json() as { id: string }).id, account.user.id);
    const item = await (await request('/api/items', 'POST', { retailer: 'bestbuy', sku: '12345', target_price: 100 }, account.token)).json() as { id: string };
    assert.ok(item.id);
    assert.equal((await request(`/api/items/${item.id}`, 'GET', undefined, second.token)).status, 404);
    assert.equal((await request(`/api/items/${item.id}`, 'DELETE', undefined, second.token)).status, 404);
    assert.equal((await request(`/api/items/${item.id}/prices`, 'GET', undefined, second.token)).status, 404);
    assert.equal((await (await request('/api/inventory', 'GET', undefined, account.token)).json() as unknown[]).length, 1);
    const disabledItem = await (await request('/api/items', 'POST', { retailer: 'amazon', model: 'Unconfigured fixture' }, account.token)).json() as { id: string };
    const events: { owner: string; event: { type: string } }[] = [];
    let sample: InventoryResult = { price: 95, in_stock: true };
    const scheduler = new Scheduler(
      pool,
      { get: async (key: string) => key.includes(':bestbuy:') ? sample : null, set: async () => {} } as unknown as JsonCache,
      { broadcast: (owner: string, event: { type: string }) => events.push({ owner, event }) } as unknown as Realtime,
      { send: async () => {} } as unknown as PushService, config,
    );
    await scheduler.tick();
    const disabledStatus = await (await request(`/api/items/${disabledItem.id}`, 'GET', undefined, account.token)).json() as { current_price: number | null; in_stock: boolean | null; last_check_error: string; last_checked_at: string };
    assert.equal(disabledStatus.current_price, null);
    assert.equal(disabledStatus.in_stock, null);
    assert.match(disabledStatus.last_check_error, /requires.*ASIN/);
    assert.ok(disabledStatus.last_checked_at);
    const notifications = await (await request('/api/notifications', 'GET', undefined, account.token)).json() as { id: string }[];
    assert.equal(notifications.length, 1);
    assert.ok(events.some(event => event.owner === account.user.id && event.event.type === 'notification'));
    assert.equal((await request(`/api/notifications/${notifications[0].id}`, 'PATCH', { read: true }, second.token)).status, 404);
    assert.equal((await request(`/api/notifications/${notifications[0].id}`, 'PATCH', { read: true }, account.token)).status, 200);
    const prices = await (await request(`/api/items/${item.id}/prices`, 'GET', undefined, account.token)).json() as { price: number }[];
    assert.equal(prices[0].price, 95);
    const stockItem = await (await request('/api/items', 'POST', {
      retailer: 'bestbuy', sku: '22222', notify_stock: true, notify_price: false,
    }, account.token)).json() as { id: string; notify_stock: boolean; notify_price: boolean; target_price: null };
    const priceItem = await (await request('/api/items', 'POST', {
      retailer: 'bestbuy', sku: '33333', notify_stock: false, notify_price: true, target_price: 100,
    }, account.token)).json() as { id: string; notify_stock: boolean; notify_price: boolean };
    assert.equal(stockItem.notify_stock, true);
    assert.equal(stockItem.notify_price, false);
    assert.equal(stockItem.target_price, null);
    assert.equal(priceItem.notify_stock, false);
    assert.equal(priceItem.notify_price, true);
    assert.equal((await request('/api/items', 'POST', {
      retailer: 'bestbuy', sku: '44444', notify_stock: false, notify_price: false,
    }, account.token)).status, 400);
    sample = { price: null, in_stock: false };
    await scheduler.tick();
    const stockHistory = await (await request(`/api/items/${stockItem.id}/prices`, 'GET', undefined, account.token)).json() as { price: number | null; in_stock: boolean }[];
    assert.equal(stockHistory[0].price, null);
    assert.equal(stockHistory[0].in_stock, false);
    const checkNewItems = async () => {
      await pool.query("UPDATE tracked_items SET last_checked_at=now()-interval '30 minutes' WHERE id=ANY($1::uuid[])", [[stockItem.id, priceItem.id]]);
      await scheduler.tick();
    };
    const alertCount = async () => (await (await request('/api/notifications', 'GET', undefined, account.token)).json() as unknown[]).length;
    sample = { price: null, in_stock: true };
    await checkNewItems();
    assert.equal(await alertCount(), 2, 'stock-only restock alerts must not require a price');
    await checkNewItems();
    assert.equal(await alertCount(), 2, 'unchanged stock must not repeat alerts');
    sample = { price: 150, in_stock: true };
    await checkNewItems();
    assert.equal(await alertCount(), 2, 'price-only items must not alert above the target');
    sample = { price: 80, in_stock: true };
    await checkNewItems();
    assert.equal(await alertCount(), 3, 'price-only items alert at the target, stock-only items ignore price changes');
    await request('/api/settings', 'PATCH', { notifications_enabled: false, check_interval_minutes: 5 }, account.token);
    await pool.query("UPDATE tracked_items SET last_checked_at=now()-interval '10 minutes' WHERE id=$1", [item.id]);
    sample = { price: 90, in_stock: true };
    await scheduler.tick();
    assert.equal((await (await request('/api/notifications', 'GET', undefined, account.token)).json() as unknown[]).length, 3);
    assert.equal((await (await request(`/api/items/${item.id}/prices`, 'GET', undefined, account.token)).json() as unknown[]).length, 2);
    await scheduler.stop();
    assert.equal((await request('/api/notifications/devices', 'POST', { token: 'fixture-device' }, account.token)).status, 201);
    assert.equal((await request('/api/notifications/devices', 'POST', { token: 'fixture-device' }, second.token)).status, 409);
    await request('/api/notifications/devices', 'DELETE', { token: 'fixture-device' }, second.token);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM device_tokens WHERE user_id=$1', [account.user.id])).rows[0].count, 1);
    await request('/api/notifications/devices', 'DELETE', { token: 'fixture-device' }, account.token);
    assert.equal((await request(`/api/items/${item.id}`, 'DELETE', undefined, account.token)).status, 204);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM price_history WHERE item_id=$1', [item.id])).rows[0].count, 0);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
    await pool.end();
  }
});
