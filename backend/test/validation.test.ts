import test from 'node:test';
import assert from 'node:assert/strict';
import { credentials, newItem, updateSettings, readNotification, deviceToken } from '../src/validation.js';
import { parseConfig } from '../src/config/environment.js';

test('validates and normalizes credentials', () => {
  assert.equal(credentials.parse({ email: ' PERSON@EXAMPLE.COM ', password: 'abcdefgh' }).email, 'person@example.com');
  assert.equal(credentials.safeParse({ email: 'bad', password: 'short' }).success, false);
  assert.equal(credentials.safeParse({ email: 'a@b.com', password: 'abcdefgh', admin: true }).success, false);
});
test('validates item sources and nonnegative prices', () => {
  assert.equal(newItem.safeParse({ retailer: 'bestbuy', sku: '12345', target_price: 0 }).success, true);
  for (const item of [
    { retailer: 'fake', sku: '123' }, { retailer: 'amazon' },
    { retailer: 'apple', model: 'iPhone', target_price: -1 },
    { retailer: 'target', url: 'file:///etc/passwd' },
  ]) assert.equal(newItem.safeParse(item).success, false);
});
test('preferences and notifications reject coercion and invalid updates', () => {
  assert.equal(updateSettings.safeParse({ check_interval_minutes: 5 }).success, true);
  assert.equal(updateSettings.safeParse({ check_interval_minutes: 4 }).success, false);
  assert.equal(updateSettings.safeParse({ notifications_enabled: 'false' }).success, false);
  assert.equal(updateSettings.safeParse({}).success, false);
  assert.equal(readNotification.safeParse({ read: false }).success, false);
  assert.equal(deviceToken.safeParse({ token: '' }).success, false);
});
test('item alert options accept stock-only, price-only, both, and legacy clients', () => {
  const source = { retailer: 'bestbuy', sku: '12345' };
  assert.deepEqual(newItem.parse(source), { ...source, notify_stock: true, notify_price: false, fulfillment: 'shipping' });
  assert.equal(newItem.parse({ ...source, target_price: 100 }).notify_price, true);
  assert.equal(newItem.safeParse({ ...source, notify_stock: false, notify_price: true, target_price: 0 }).success, true);
  assert.equal(newItem.safeParse({ ...source, notify_stock: true, notify_price: true, target_price: 100 }).success, true);
  for (const flags of [
    { notify_stock: false, notify_price: false },
    { notify_stock: false },
    { notify_price: true },
    { notify_stock: 'true' },
    { notify_price: 'false' },
  ]) assert.equal(newItem.safeParse({ ...source, ...flags }).success, false);
});
test('Apple pickup requires a ZIP and exact product URL, defaults to 50 miles, and preserves leading zeros', () => {
  const source = { retailer: 'apple', url: 'https://www.apple.com/shop/buy-iphone/iphone-duo/7.6-inch-display-256gb-night-sky-att',
    fulfillment: 'pickup', pickup_zip: '02108' };
  const parsed = newItem.parse(source);
  assert.equal(parsed.pickup_zip, '02108');
  assert.equal(parsed.pickup_radius_miles, 50);
  for (const radius of [1, 50, 250]) assert.equal(newItem.safeParse({ ...source, pickup_radius_miles: radius }).success, true);
  for (const invalid of [
    { pickup_zip: undefined }, { pickup_zip: '1234' }, { pickup_zip: '123456' }, { pickup_zip: 2108 },
    { pickup_radius_miles: 0 }, { pickup_radius_miles: 251 }, { pickup_radius_miles: 2.5 },
    { pickup_radius_miles: '50' }, { retailer: 'amazon' }, { url: undefined },
    { fulfillment: 'shipping' },
  ]) assert.equal(newItem.safeParse({ ...source, ...invalid }).success, false);
  assert.equal(newItem.safeParse({ retailer: 'apple', model: 'iPhone', pickup_radius_miles: 50 }).success, false);
});
test('environment requires strong JWT and valid cron', () => {
  const env = { DATABASE_URL: 'postgresql://localhost/db', REDIS_URL: 'redis://localhost', JWT_SECRET: 'a'.repeat(64) };
  assert.equal(parseConfig(env).PORT, 3000);
  assert.deepEqual(parseConfig(env).CORS_ORIGIN, ['http://localhost:5173', 'null', 'file://']);
  assert.throws(() => parseConfig({ ...env, CORS_ORIGIN: 'javascript:alert(1)' }));
  assert.throws(() => parseConfig({ ...env, CORS_ORIGIN: 'file:///etc/passwd' }));
  assert.throws(() => parseConfig({ ...env, CORS_ORIGIN: '*' }));
  assert.throws(() => parseConfig({ ...env, JWT_SECRET: 'short' }));
  assert.throws(() => parseConfig({ ...env, CHECK_CRON: 'bad cron' }));
  assert.throws(() => parseConfig({ ...env, FIREBASE_ENABLED: 'true' }));
});
