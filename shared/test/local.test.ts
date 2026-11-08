import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkResultMessage, LocalMonitor, LocalStore, type InventoryResult } from '../src/index.js';
import { DesktopDatabase } from '../../desktop/src/main/database.js';

test('SQLite watchlist, history, alerts and settings survive reopening without any server', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'inventory-local-test-'));
  const path = join(directory, 'inventory.sqlite');
  let database = new DesktopDatabase(path);
  try {
    const store = new LocalStore(database, randomUUID);
    await store.initialize(); await store.initialize();
    const item = await store.addItem({ retailer: 'apple', model: 'Fixture', url: 'https://www.apple.com/shop/product/abc12/a',
      notify_stock: true, notify_price: false, fulfillment: 'pickup', pickup_zip: '02108' });
    assert.equal(item.pickup_zip, '02108');
    assert.equal(item.pickup_radius_miles, 50);
    const first = { id: 'R001', name: 'Nearby Store', distance_miles: 50, available: false };
    await store.applyResult(item.id, { price: null, in_stock: false, pickup_stores: [first] });
    await store.applyResult(item.id, { price: null, in_stock: true, pickup_stores: [{ ...first, available: true }] });
    await store.applyResult(item.id, { price: null, in_stock: true, pickup_stores: [{ available: true, distance_miles: 50, name: 'Nearby Store', id: 'R001' }] });
    assert.equal((await store.prices(item.id)).length, 2);
    assert.equal((await store.notifications()).length, 1);
    const alert = (await store.notifications())[0];
    await store.checkFailed(item.id, 'Apple pickup returned HTTP 541');
    await store.saveSettings({ notifications_enabled: false, check_interval_minutes: 5, background_enabled: false });
    await database.close();
    database = new DesktopDatabase(path);
    const reopened = new LocalStore(database, randomUUID);
    await reopened.initialize();
    assert.equal((await reopened.item(item.id)).in_stock, true);
    assert.match((await reopened.item(item.id)).last_check_error!, /541/);
    assert.equal((await reopened.prices(item.id))[0].price, null);
    assert.equal((await reopened.settings()).check_interval_minutes, 5);
    await reopened.markRead(alert.id);
    assert.equal((await reopened.notifications())[0].read, true);
    await reopened.deleteItem(item.id);
    assert.equal((await reopened.items()).length, 0);
    assert.equal((await database.all('SELECT * FROM history')).length, 0);
    await assert.rejects(reopened.deleteItem(item.id), /not found/);
    await assert.rejects(reopened.addItem({ retailer: 'apple', model: 'x', notify_stock: false, notify_price: false }), /Select stock/);
    await assert.rejects(reopened.saveSettings({ notifications_enabled: true, check_interval_minutes: 0, background_enabled: true }));
  } finally {
    await database.close();
    for (const file of await readdir(directory)) await unlink(join(directory, file));
    await rmdir(directory);
  }
});

test('transactional snapshots reject invalid pickup results and retain the previous state', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    const store = new LocalStore(db, randomUUID);
    await store.initialize();
    const item = await store.addItem({ retailer: 'apple', model: 'Fixture', url: 'https://www.apple.com/shop/product/abc12/a',
      fulfillment: 'pickup', pickup_zip: '10001' });
    for (const result of [
      { price: null, in_stock: true },
      { price: null, in_stock: true, pickup_stores: [] },
      { price: null, in_stock: true, pickup_stores: [{ id: 'R001', name: 'Far', distance_miles: 51, available: true }] },
    ]) await assert.rejects(store.applyResult(item.id, result), /invalid store/);
    assert.equal((await store.item(item.id)).in_stock, null);
    assert.equal((await store.prices(item.id)).length, 0);
    await assert.rejects(db.transaction(async tx => {
      await tx.run('DELETE FROM items WHERE id=?', [item.id]);
      throw new Error('Rollback fixture');
    }), /Rollback/);
    assert.equal((await store.items()).length, 1);
  } finally { await db.close(); }
});

test('local monitor checks due items, catches up after wake, retains failures and retries durable device alerts', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    let time = Date.now();
    const store = new LocalStore(db, randomUUID, () => time);
    await store.initialize();
    const item = await store.addItem({ retailer: 'bestbuy', sku: '12345', target_price: 100 });
    let sample: InventoryResult = { price: 120, in_stock: false };
    let calls = 0;
    let blocked = false;
    let permission = false;
    let delivered = 0;
    const monitor = new LocalMonitor(store, randomUUID(), async () => 'fixture-key', async () => {
      if (!permission) throw new Error('Notifications denied');
      delivered++;
    }, () => {}, async (_item, key) => {
      assert.equal(key, 'fixture-key');
      calls++;
      if (blocked) throw new Error('HTTP 541');
      return sample;
    }, () => time);
    await monitor.tick(); assert.equal(calls, 1);
    time += 14 * 60000; await monitor.tick(); assert.equal(calls, 1);
    time += 60000; sample = { price: 90, in_stock: true }; await monitor.tick();
    assert.equal(calls, 2);
    assert.equal((await store.notifications()).length, 1);
    assert.match((await store.notifications())[0].delivery_error!, /denied/);
    assert.match((await store.status()).error!, /could not be delivered/);
    permission = true; await monitor.tick(); assert.equal(delivered, 1);
    await monitor.tick(); assert.equal(delivered, 1);
    time += 3 * 60 * 60000;
    blocked = true; await monitor.tick();
    assert.equal(calls, 3);
    assert.equal((await store.item(item.id)).in_stock, true);
    assert.match((await store.item(item.id)).last_check_error!, /541/);
    await store.saveSettings({ ...await store.settings(), background_enabled: false });
    time += 60000 * 20; await monitor.tick({ background: true }); assert.equal(calls, 3);
    await monitor.stop(); await monitor.tick(); assert.equal(calls, 3);
  } finally { await db.close(); }
});

test('monitor lease excludes concurrent runtimes and expires after process termination', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    let time = Date.now();
    const store = new LocalStore(db, randomUUID, () => time);
    await store.initialize();
    const claims = await Promise.all([store.claim('first'), store.claim('second')]);
    assert.deepEqual(claims, [true, false]);
    await store.finish('second', null);
    assert.equal(await store.claim('second'), false);
    time += 120001;
    assert.equal(await store.claim('second'), true);
    await store.finish('first', null);
    assert.equal(await store.claim('third'), false);
    await store.finish('second', null);
    assert.equal(await store.claim('third'), true);
  } finally { await db.close(); }
});
test('an inaccessible retailer key does not stop other retailer checks', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    const store = new LocalStore(db, randomUUID);
    await store.initialize();
    const bestbuy = await store.addItem({ retailer: 'bestbuy', sku: '12345' });
    const apple = await store.addItem({ retailer: 'apple', url: 'https://www.apple.com/shop/product/abc12/a' });
    await store.saveSettings({ ...await store.settings(), notifications_enabled: false });
    const monitor = new LocalMonitor(store, randomUUID(), async () => { throw new Error('Keychain locked'); },
      async () => {}, () => {}, async item => {
        assert.equal(item.retailer, 'apple');
        return { price: 129, in_stock: true };
      });

    await monitor.tick();
    assert.match((await store.item(bestbuy.id)).last_check_error!, /Keychain locked/);
    assert.equal((await store.item(apple.id)).current_price, 129);
    await monitor.stop();
  } finally { await db.close(); }
});

test('manual checks retry recently checked products, report failures, and preserve scheduled intervals', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    const store = new LocalStore(db, randomUUID);
    await store.initialize();
    await store.addItem({ retailer: 'amazon', sku: 'B0CL61F39H' });
    await store.addItem({ retailer: 'bestbuy', sku: '12345' });
    let calls = 0;
    const monitor = new LocalMonitor(store, randomUUID(), async () => undefined, async () => {}, () => {}, async item => {
      calls++;
      if (item.retailer === 'bestbuy') throw new Error('Missing key');
      return { price: 100, in_stock: true };
    });
    await monitor.tick();
    assert.equal((await monitor.tick()).checked, 0);
    const result = await monitor.checkNow();
    assert.deepEqual(result, { checked: 2, succeeded: 1, failed: 1, remaining: 0, reason: 'complete' });
    assert.equal(calls, 4);
    assert.match(checkResultMessage(result), /1 succeeded, 1 failed/);
    await monitor.tick(); assert.equal(calls, 4);
    await store.claim('other');
    assert.equal((await monitor.checkNow()).reason, 'busy');
    await store.finish('other', null);
    await monitor.stop();
    assert.equal((await monitor.checkNow()).reason, 'stopped');
  } finally { await db.close(); }
});

test('manual requests wait for an existing scheduled run and coalesce without overlap', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    const store = new LocalStore(db, randomUUID);
    await store.initialize();
    await store.addItem({ retailer: 'amazon', sku: 'B0CL61F39H' });
    let release!: () => void;
    let started!: () => void;
    const active = new Promise<void>(resolve => { started = resolve; });
    const wait = new Promise<void>(resolve => { release = resolve; });
    let calls = 0;
    const monitor = new LocalMonitor(store, randomUUID(), async () => undefined, async () => {}, () => {}, async () => {
      calls++;
      if (calls === 1) { started(); await wait; }
      return { price: 100, in_stock: false };
    });
    const scheduled = monitor.tick();
    await active;
    const manual = monitor.checkNow();
    assert.equal(manual, monitor.checkNow());
    release();
    await scheduled;
    assert.equal((await manual).checked, 1);
    assert.equal(calls, 2);
    await monitor.stop();
  } finally { await db.close(); }
});

test('manual checking covers more than 25 items but does not launch queued work after suspension', async () => {
  const db = new DesktopDatabase(':memory:');
  try {
    const store = new LocalStore(db, randomUUID);
    await store.initialize();
    await store.saveSettings({ ...await store.settings(), notifications_enabled: false });
    for (let index = 0; index < 30; index++) await store.addItem({ retailer: 'amazon', sku: 'B0CL61F39H' });
    let cancel = false;
    const monitor = new LocalMonitor(store, randomUUID(), async () => undefined, async () => {}, () => {}, async () => {
      if (cancel) monitor.cancelRun();
      return { price: 100, in_stock: false };
    });
    assert.equal((await monitor.checkNow()).checked, 30);
    cancel = true;
    const active = monitor.tick({ force: true });
    const manual = monitor.checkNow();
    await active;
    assert.deepEqual(await manual, { checked: 0, succeeded: 0, failed: 0, remaining: 30, reason: 'interrupted' });
    await monitor.stop();
  } finally { await db.close(); }
});

test('local backups transfer watchlists and history without accounts or credentials; import is atomic and repeatable', async () => {
  const sourceDb = new DesktopDatabase(':memory:');
  const targetDb = new DesktopDatabase(':memory:');
  try {
    const source = new LocalStore(sourceDb, randomUUID);
    const target = new LocalStore(targetDb, randomUUID);
    await source.initialize(); await target.initialize();
    const item = await source.addItem({ retailer: 'bestbuy', sku: '12345', target_price: 100 });
    await source.applyResult(item.id, { price: 90, in_stock: true });
    const [backup] = await Promise.all([
      source.exportBackup(),
      source.applyResult(item.id, { price: 80, in_stock: true }),
    ]);
    assert.equal((await source.item(item.id)).current_price, 80);
    assert.equal(JSON.parse(backup).items[0].history[0].price, 90, 'backup must use one consistent snapshot');
    assert.equal(backup.includes('user_id'), false);
    assert.equal(backup.includes('api_key'), false);
    await target.importBackup(backup); await target.importBackup(backup);
    assert.equal((await target.items()).length, 1);
    assert.equal((await target.item(item.id)).current_price, 90);
    assert.equal((await target.prices(item.id)).length, 1);
    assert.equal((await target.notifications()).length, 1);
    assert.equal((await target.notifications(true)).length, 0, 'imported alerts must not be re-delivered');
    const invalid = JSON.parse(backup);
    invalid.items.push({ ...invalid.items[0], id: randomUUID() });
    await assert.rejects(target.importBackup(JSON.stringify(invalid)), /UNIQUE/);
    assert.equal((await target.items()).length, 1, 'failed import must rollback new entries');
    await assert.rejects(target.importBackup('not JSON'));
    await assert.rejects(target.importBackup('\u20ac'.repeat(6 * 1024 * 1024)), /16 MB/);
  } finally { await sourceDb.close(); await targetDb.close(); }
});
