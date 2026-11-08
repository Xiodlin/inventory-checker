import test from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from '../src/database/models/TrackedItem.js';
import { applePickupProduct, parseApplePickup } from '../src/scrapers/applePickupScraper.js';
import { checkInventory } from '../src/scrapers/index.js';

const part = 'MK1F4LL/A+att';
const item: Item = {
  id: 'fixture', user_id: 'owner', retailer: 'apple', brand: 'Apple', model: 'iPhone', sku: 'WRONG',
  url: 'https://www.apple.com/shop/buy-iphone/iphone-duo/7.6-inch-display-256gb-night-sky-att',
  current_price: null, target_price: null, in_stock: null, notify_stock: true, notify_price: false,
  fulfillment: 'pickup', pickup_zip: '10001', pickup_radius_miles: 50, pickup_stores: [],
  last_checked_at: null, last_check_error: null,
};
const page = new URL(item.url!);
const offer = { '@type': 'Offer', sku: part, price: 1999, priceCurrency: 'USD' };
const html = (offers: unknown = [offer], url = page.href) =>
  `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', url, offers })}</script>`;
const store = (id: string, distance: number, status = 'available', unit = 'mi', eligible = true) => ({
  storeNumber: id, storeName: `Store ${id}`, retailStore: { distance, distanceUnit: unit },
  partsAvailability: { [part]: { partNumber: part, storePickEligible: eligible, pickupDisplay: status } },
});
const response = (stores: unknown[], location = '10001') => ({
  head: { status: '200' }, body: { stores, location },
});

test('exact configured Apple URL resolves carrier-specific part and USD price without shipping stock', () => {
  assert.deepEqual(applePickupProduct(html(), page), { part, price: 1999 });
  assert.deepEqual(applePickupProduct(html([{ sku: part }]), page), { part, price: null });
  assert.throws(() => applePickupProduct(html([offer, { ...offer, sku: 'MK1F4LL/A' }]), page), /exact/);
  assert.throws(() => applePickupProduct(html([{ ...offer, sku: undefined }]), page));
  assert.throws(() => applePickupProduct(html([offer], page.href.replace('256gb', '512gb')), page), /does not match/);
  assert.throws(() => applePickupProduct(html([{ ...offer, priceCurrency: 'EUR' }]), page), /USD/);
});

test('pickup radius includes exactly 50 miles, excludes anything beyond, converts km before filtering, and sorts nearest first', () => {
  const stores = parseApplePickup(response([
    store('R101', 50), store('R102', 50.0001), store('R103', 16.09344, 'unavailable', 'km'),
    store('R104', 80.4672, 'available', 'km'), store('R105', 80.468, 'available', 'km'),
    store('R106', 0),
  ]), part, '10001', 50);
  assert.deepEqual(stores.map(value => value.id), ['R106', 'R103', 'R101', 'R104']);
  assert.equal(stores[1].distance_miles, 10);
  assert.equal(stores[1].available, false);
  assert.equal(stores[2].distance_miles, 50);
});

test('pickup availability requires the exact part, a known status, store eligibility, valid distance, and matching location', () => {
  assert.equal(parseApplePickup(response([store('R101', 10, 'available', 'mi', false)]), part, '10001', 50)[0].available, false);
  assert.equal(parseApplePickup(response([store('R101', 10, 'ineligible')]), part, '10001', 50)[0].available, false);
  assert.deepEqual(parseApplePickup(response([store('R101', 60)]), part, '10001', 50), []);
  for (const data of [
    response([store('R101', 10)], '90210'), response([]),
    response([store('R101', -1)]), response([store('R101', 10, 'available', 'yards')]),
    response([store('R101', 10, 'unknown')]), response([store('R101', 10), store('R101', 11)]),
    response([{ ...store('R101', 10), partsAvailability: {} }]),
    response([{ ...store('R101', 10), partsAvailability: { [part]: { partNumber: 'different', storePickEligible: true, pickupDisplay: 'available' } } }]),
    { head: { status: '541' }, body: { stores: [], location: '10001' } },
  ]) assert.throws(() => parseApplePickup(data, part, '10001', 50));
  const nested = { head: { status: 200 }, body: { content: { pickupMessage: response([store('R101', 10)]).body } } };
  assert.equal(parseApplePickup(nested, part, '10001', 50)[0].available, true);
});

test('adapter sends only ZIP and exact part to fixed Apple pickup endpoint, never shipping stock', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://www.apple.com');
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    if (calls === 1) {
      assert.equal(url.href, page.href);
      return new Response(html(), { headers: { 'content-type': 'text/html' } });
    }
    assert.equal(url.pathname, '/shop/fulfillment-messages');
    assert.equal(url.searchParams.get('location'), '10001');
    assert.equal(url.searchParams.get('parts.0'), part);
    assert.equal(url.searchParams.get('pl'), 'true');
    return Response.json(response([store('R101', 15, 'unavailable'), store('R102', 75)]));
  };
  const result = await checkInventory(item, undefined, fetcher);
  assert.equal(calls, 2);
  assert.equal(result.price, 1999);
  assert.equal(result.in_stock, false, 'available stores outside radius must not make pickup available');
  assert.deepEqual(result.pickup_stores, [{ id: 'R101', name: 'Store R101', distance_miles: 15, available: false }]);
});

test('blocked, HTML, and malformed pickup responses fail without retries or shipping fallbacks', async () => {
  for (const bad of [
    new Response('Blocked', { status: 541 }),
    new Response('Verify you are human', { headers: { 'content-type': 'text/html' } }),
    new Response('{bad', { headers: { 'content-type': 'application/json' } }),
    Response.json({ head: { status: '200' }, body: {} }),
  ]) {
    let calls = 0;
    await assert.rejects(checkInventory(item, undefined, async () => {
      calls++;
      return calls === 1 ? new Response(html(), { headers: { 'content-type': 'text/html' } }) : bad;
    }));
    assert.equal(calls, 2);
  }
});

test('pickup validates location and product URLs before network access', async () => {
  const noFetch: typeof fetch = async () => { throw new Error('Must not fetch'); };
  await assert.rejects(checkInventory({ ...item, pickup_zip: null }, undefined, noFetch), /ZIP/);
  await assert.rejects(checkInventory({ ...item, pickup_radius_miles: 0 }, undefined, noFetch), /radius/);
  await assert.rejects(checkInventory({ ...item, url: 'https://evil.example/shop/buy-iphone/iphone-duo/configuration' }, undefined, noFetch), /HTTPS product URL/);
  await assert.rejects(checkInventory({ ...item, url: 'https://www.apple.com/shop/buy-iphone/iphone-duo' }, undefined, noFetch), /specific/);
});
