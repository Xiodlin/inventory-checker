import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { JsonCache } from '../src/services/cacheService.js';

test('Redis JSON cache round-trips values and enforces TTL', { skip: !process.env.TEST_REDIS_URL }, async () => {
  const cache = new JsonCache(process.env.TEST_REDIS_URL!);
  const key = `inventory-test:${randomUUID()}`;
  try {
    await cache.connect();
    assert.equal(await cache.get(key), null);
    await cache.set(key, { price: 19.99, in_stock: true }, 1);
    assert.deepEqual(await cache.get(key), { price: 19.99, in_stock: true });
    await setTimeout(1200);
    assert.equal(await cache.get(key), null);
  } finally { await cache.close(); }
});
