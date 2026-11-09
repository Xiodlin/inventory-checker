import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LocalMonitor, LocalStore, ShoppingMonitor, type ShoppingOffer, type ShoppingSearch } from '../src/index.js';
import { DesktopDatabase } from '../../desktop/src/main/database.js';

const input = { product: 'MacBook Neo', variants: ['256GB', 'Indigo'] };
const offer: ShoppingOffer = { title: 'MacBook Neo 256GB Indigo', seller: 'Target',
  url: 'https://www.google.com/aclk?token=first', price: '$699.00', match: 'text-match', missing: [],
  availability: 'reported-in-stock', availability_text: 'Pickup today' };
const outcome = (offers: ShoppingOffer[], error: string | null = null): ShoppingSearch =>
  ({ id: randomUUID(), input, checked_at: new Date().toISOString(), offers, error });

test('saved searches use retailer settings, retry empty matches and notify only fresh explicit stock', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    let time = Date.now();
    let calls = 0;
    let result = outcome([{ ...offer, match: 'uncertain' }]);
    const store = new LocalStore(db, randomUUID, () => time);
    await store.initialize();
    await store.saveSettings({ notifications_enabled: true, background_enabled: true, check_interval_minutes: 5 });
    const shopping = new ShoppingMonitor(store, randomUUID, async () => { calls++; return result; }, () => {}, () => time);
    await shopping.save(input); await shopping.save({ ...input, variants: ['Indigo', '256GB'] });
    assert.equal((await shopping.watches()).length, 1, 'saving the same search must not create duplicate watches');
    await shopping.tick();
    assert.equal(calls, 1);
    assert.equal((await store.notifications()).length, 0);
    time += 5 * 60000;
    result = outcome([{ ...offer, verification: { status: 'verified', in_stock: false, message: 'Retailer out of stock' } }]);
    await shopping.tick();
    assert.equal((await store.notifications()).length, 0, 'conflicting verified out-of-stock must suppress a Google stock alert');
    await shopping.tick(); assert.equal(calls, 2);
    time += 5 * 60000;
    result = outcome([{ ...offer, availability: 'unknown' }]);
    await shopping.tick(); assert.equal((await store.notifications()).length, 0);
    time += 5 * 60000; result = outcome([offer, { ...offer, url: 'https://www.google.com/aclk?token=duplicate' }]);
    await shopping.tick();
    assert.equal((await store.notifications()).length, 1);
    assert.match((await store.notifications())[0].body, /not retailer-verified/);
    assert.deepEqual((await store.notifications())[0].target, { kind: 'shopping', id: (await shopping.watches())[0].id });
    time += 5 * 60000;
    result = outcome([{ ...offer, price: '$599.00', url: 'https://www.google.com/aclk?token=changed' }]);
    await shopping.tick();
    assert.equal((await store.notifications()).length, 1, 'tracking tokens and price changes must not repeat stock alerts');
    time += 5 * 60000; result = outcome([{ ...offer, availability: 'unknown' }]);
    await shopping.tick();
    time += 5 * 60000; result = outcome([offer]);
    await shopping.tick();
    assert.equal((await store.notifications()).length, 1, 'a missing stock label must not manufacture a restock transition');
    time += 5 * 60000; result = outcome([], 'Google returned HTTP 429');
    await shopping.tick();
    assert.match((await shopping.watches())[0].error!, /429/);
    assert.equal((await shopping.watches())[0].result?.offers.length, 1, 'errors retain last successful offers');
    time += 5 * 60000; result = outcome([offer]);
    await shopping.tick(); assert.equal((await store.notifications()).length, 1, 'errors must not reset stock deduplication');
    time += 5 * 60000; result = outcome([]);
    await shopping.tick();
    time += 5 * 60000; result = outcome([offer]);
    await shopping.tick(); assert.equal((await store.notifications()).length, 2, 'a match returning after a successful absence triggers stock again');
    let delivered = 0;
    const monitor = new LocalMonitor(store, randomUUID(), async () => undefined, async () => { delivered++; }, () => {});
    await monitor.tick(); assert.equal(delivered, 2);
    await monitor.tick(); assert.equal(delivered, 2, 'native delivery uses the existing durable queue');
    await store.saveSettings({ notifications_enabled: true, background_enabled: false, check_interval_minutes: 5 });
    time += 5 * 60000;
    const before = calls; await shopping.tick(); assert.equal(calls, before);
    await shopping.remove((await shopping.watches())[0].id);
    assert.equal((await shopping.watches()).length, 0);
    assert.equal((await store.notifications()).length, 2, 'deleting a search retains its alerts');
  } finally { await db.close(); }
});

test('search scheduling coalesces ticks, cancels on suspend and does not recreate deleted watches', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    const store = new LocalStore(db, randomUUID); await store.initialize();
    let resolve!: (value: ShoppingSearch) => void;
    let started!: () => void;
    let ready = new Promise<void>(done => { started = done; });
    const shopping = new ShoppingMonitor(store, randomUUID,
      () => { started(); return new Promise(done => { resolve = done; }); }, () => {});
    await shopping.save(input);
    const first = shopping.tick(); assert.equal(first, shopping.tick());
    await ready;
    shopping.cancel(); resolve(outcome([offer])); await first;
    assert.equal((await shopping.watches())[0].last_checked_at, null);
    assert.equal((await store.notifications()).length, 0);
    ready = new Promise<void>(done => { started = done; });
    const next = shopping.tick(); await ready;
    await shopping.remove((await shopping.watches())[0].id);
    resolve(outcome([offer])); await next;
    assert.equal((await shopping.watches()).length, 0);
    assert.equal((await store.notifications()).length, 0);
  } finally { await db.close(); }
});

test('saved searches persist independently of recent history and report thrown checker failures', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    const store = new LocalStore(db, randomUUID); await store.initialize();
    const shopping = new ShoppingMonitor(store, randomUUID, async () => { throw new Error('Browser unavailable'); }, () => {});
    await shopping.save(input); await shopping.tick();
    const reopened = new ShoppingMonitor(store, randomUUID, async () => outcome([]), () => {});
    const watches = await reopened.watches();
    assert.equal(watches.length, 1); assert.match(watches[0].error!, /Browser unavailable/);
    assert.ok(watches[0].last_checked_at); assert.equal(watches[0].result, null);
    assert.equal((await store.notifications()).length, 0);
    assert.doesNotMatch(await store.exportBackup(), /shopping_watches/);
    await assert.rejects(shopping.save({ ...input, variants: [] }));
  } finally { await db.close(); }
});

test('Check now retries every saved product even when automatic searches are paused', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    const store = new LocalStore(db, randomUUID); await store.initialize();
    await store.saveSettings({ notifications_enabled: false, check_interval_minutes: 15, background_enabled: false });
    const checked: string[] = [];
    const shopping = new ShoppingMonitor(store, randomUUID, async input => {
      checked.push(input.product); return outcome([]);
    }, () => {});
    await shopping.save(input);
    await shopping.save({ product: 'iPhone Duo', variants: ['256GB'] });
    await shopping.tick(); assert.equal(checked.length, 0);
    const manual = shopping.checkNow();
    assert.equal(manual, shopping.checkNow(), 'manual requests must coalesce');
    await manual;
    assert.deepEqual(checked.sort(), ['MacBook Neo', 'iPhone Duo'].sort());
    await shopping.checkNow();
    assert.equal(checked.length, 4, 'manual checks must retry recently checked products');
  } finally { await db.close(); }
});

test('manual search checks wait for scheduled work and cancel queued work on suspension', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    const store = new LocalStore(db, randomUUID); await store.initialize();
    let calls = 0;
    let resolve!: (value: ShoppingSearch) => void;
    let started!: () => void;
    const ready = new Promise<void>(done => { started = done; });
    const shopping = new ShoppingMonitor(store, randomUUID, async () => {
      calls++;
      if (calls === 1) { started(); return new Promise(done => { resolve = done; }); }
      return outcome([]);
    }, () => {});
    await shopping.save(input);
    const scheduled = shopping.tick(); await ready;
    const manual = shopping.checkNow(); assert.equal(manual, shopping.checkNow());
    assert.equal(calls, 1);
    shopping.cancel(); resolve(outcome([]));
    await scheduled; await manual;
    assert.equal(calls, 1, 'suspension must not launch the queued manual search');
    await shopping.checkNow();
    assert.equal(calls, 2);
  } finally { await db.close(); }
});
