import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { parseBackup, type Item } from '@inventory-checker/core';
import { exportLegacyBackup } from '../src/exportLocal.js';

test('legacy export selects one account and produces a credential-free, consistent local backup', async t => {
  const client = new pg.Client();
  const owner = randomUUID();
  const item: Item = {
    id: randomUUID(), user_id: owner, retailer: 'apple', brand: 'Apple', model: 'Fixture',
    sku: null, url: 'https://www.apple.com/shop/product/abc12/a',
    notify_stock: true, notify_price: false, target_price: null, current_price: null,
    fulfillment: 'pickup', pickup_zip: '02108', pickup_radius_miles: 50,
    pickup_stores: [{ id: 'R001', name: 'Fixture Store', distance_miles: 50, available: true }],
    in_stock: true, last_checked_at: '2026-01-01T00:00:00.000Z', last_check_error: null,
    created_at: '2026-01-01T00:00:00.000Z',
  };
  const statements: string[] = [];
  t.mock.method(client, 'query', async (sql: string, params?: string[]) => {
    statements.push(sql);
    if (sql.includes('FROM users')) {
      assert.deepEqual(params, ['fixture@example.com']);
      return { rows: [{ id: owner, password_hash: 'must-not-be-exported' }] };
    }
    if (sql.includes('FROM tracked_items')) {
      assert.deepEqual(params, [owner]);
      return { rows: [item] };
    }
    if (sql.includes('FROM price_history')) {
      assert.deepEqual(params, [item.id]);
      return { rows: [{ id: randomUUID(), price: null, in_stock: true, pickup_stores: item.pickup_stores, checked_at: new Date(item.last_checked_at!) }] };
    }
    if (sql.includes('FROM notifications')) {
      assert.deepEqual(params, [owner]);
      return { rows: [{ id: randomUUID(), title: 'Fixture', body: 'Available', read: true, created_at: new Date(item.created_at) }] };
    }
    assert.ok(['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', 'COMMIT'].includes(sql));
    return { rows: [] };
  });
  const result = await exportLegacyBackup(client, ' Fixture@Example.com ');
  const backup = parseBackup(result.backup);
  assert.equal(result.count, 1);
  assert.equal(backup.items[0].product.pickup_zip, '02108');
  assert.equal(backup.items[0].history[0].price, null);
  assert.equal(backup.items[0].last_checked_at, item.last_checked_at);
  assert.equal(backup.notifications[0].read, true);
  assert.equal(result.backup.includes('password_hash'), false);
  assert.equal(result.backup.includes('user_id'), false);
  assert.equal(statements[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(statements.at(-1), 'COMMIT');
});

test('legacy export rolls back rather than exporting an unknown account or invalid snapshot', async t => {
  const client = new pg.Client();
  const statements: string[] = [];
  t.mock.method(client, 'query', async (sql: string) => {
    statements.push(sql);
    return { rows: [] };
  });
  await assert.rejects(exportLegacyBackup(client, 'missing@example.com'), /Account not found/);
  assert.equal(statements.at(-1), 'ROLLBACK');

  t.mock.method(client, 'query', async (sql: string) => {
    statements.push(sql);
    if (sql.includes('FROM users')) return { rows: [{ id: randomUUID() }] };
    if (sql.includes('FROM tracked_items')) return { rows: [{ id: randomUUID(), retailer: 'invalid' }] };
    return { rows: [] };
  });
  await assert.rejects(exportLegacyBackup(client, 'fixture@example.com'));
  assert.equal(statements.at(-1), 'ROLLBACK');
});
