import test from 'node:test';
import assert from 'node:assert/strict';
import { checkInventory } from '../src/scrapers/index.js';
import { NotConfiguredError } from '../src/scrapers/baseScraper.js';
import type { Item } from '../src/database/models/TrackedItem.js';
const item = { retailer: 'bestbuy', sku: '12345', url: 'http://127.0.0.1/internal' } as Item;

test('disabled integrations fail explicitly without network calls', async () => {
  const noFetch = (async () => { throw new Error('Must not fetch'); }) as typeof fetch;
  await assert.rejects(checkInventory(item, undefined, noFetch), NotConfiguredError);
  await assert.rejects(checkInventory({ ...item, retailer: 'amazon' }, 'key', noFetch), NotConfiguredError);
});
test('Best Buy uses only fixed API host, query params, timeout, no redirects', async () => {
  const mock = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'api.bestbuy.com');
    assert.equal(url.searchParams.get('apiKey'), 'secret & value');
    assert.match(url.pathname, /sku=12345/);
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    return Response.json({ products: [{ salePrice: 99.99, onlineAvailability: true }] });
  }) as typeof fetch;
  assert.deepEqual(await checkInventory(item, 'secret & value', mock), { price: 99.99, in_stock: true });
  await assert.rejects(checkInventory({ ...item, sku: '123)|url=evil' }, 'key', mock), /numeric SKU/);
});
test('upstream malformed data and failures cannot fabricate inventory', async () => {
  await assert.rejects(checkInventory(item, 'key', (async () => Response.json({ products: [] })) as typeof fetch), /not found/);
  await assert.rejects(checkInventory(item, 'key', (async () => Response.json({ products: [{ salePrice: -1, onlineAvailability: true }] })) as typeof fetch));
  await assert.rejects(checkInventory(item, 'key', (async () => new Response('', { status: 503 })) as typeof fetch), /503/);
});
