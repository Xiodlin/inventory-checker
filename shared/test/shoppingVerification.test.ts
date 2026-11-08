import test from 'node:test';
import assert from 'node:assert/strict';
import { matchShoppingCards, verifyShoppingOffers, type ShoppingSearch } from '../src/index.js';

const input = { product: 'MacBook Neo', variants: ['256GB', 'Indigo'] };
function result(urls: string[]): ShoppingSearch {
  return { id: 'fixture', input, checked_at: new Date().toISOString(), error: null,
    offers: urls.map(url => matchShoppingCards([{title: 'MacBook Neo 256GB Indigo', seller: 'Apple', price: '$699.00',
      text: 'Free delivery tomorrow\nPickup tomorrow\nFree returns', url}], input)[0]) };
}
test('retailer verification checks matching product metadata with bounded requests', async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => {
    requests++;
    return new Response(`<script type="application/ld+json">${JSON.stringify({
      '@type':'Product', name:'MacBook Neo 256GB Indigo', offers:{price:699,priceCurrency:'USD',availability:'https://schema.org/InStock'}
    })}</script>`, {headers:{'content-type':'text/html'}});
  };
  const data = await verifyShoppingOffers(result(Array(3).fill('https://www.apple.com/shop/product/abc12/a')), input, fetcher);
  assert.equal(requests, 2);
  assert.equal(data.offers[0].verification?.status, 'verified');
  assert.equal(data.offers[0].verification?.in_stock, true);
  assert.equal(data.offers[2].verification?.status, 'skipped');
  assert.equal(data.offers[0].availability, 'reported-in-stock');
  assert.deepEqual(data.offers[0].details, ['Free delivery tomorrow', 'Pickup tomorrow', 'Free returns']);
});
test('verification never fetches opaque ads, private hosts, unsupported sellers or uncertain matches', async () => {
  const fetcher: typeof fetch = async () => { throw new Error('Must not fetch'); };
  for (const url of ['https://www.google.com/aclk?adurl=', 'https://www.google.com/goto?url=opaque',
    'https://www.google.com/url?q=https://127.0.0.1/', 'https://www.walmart.com/item/123']) {
    const checked = await verifyShoppingOffers(result([url]), input, fetcher);
    assert.equal(checked.offers[0].verification?.status, 'unsupported');
  }
  const data = result(['https://www.apple.com/shop/product/abc12/a']);
  data.offers[0].match = 'uncertain';
  assert.equal((await verifyShoppingOffers(data,input,fetcher)).offers[0].verification, undefined);
});
test('mismatched retailer variants and blocked pages remain explicit verification failures', async () => {
  const data = result(['https://www.apple.com/shop/product/abc12/a']);
  const wrong: typeof fetch = async () => new Response('<script type="application/ld+json">{"@type":"Product","name":"MacBook Neo 512GB Indigo","offers":{"availability":"https://schema.org/InStock"}}</script>',
    {headers:{'content-type':'text/html'}});
  assert.match((await verifyShoppingOffers(data,input,wrong)).offers[0].verification!.message, /required product/);
  const blocked: typeof fetch = async () => new Response('', {status:435});
  assert.match((await verifyShoppingOffers(data,input,blocked)).offers[0].verification!.message, /435/);
  const cancelled: typeof fetch = async () => { throw new Error('Must not fetch'); };
  assert.equal((await verifyShoppingOffers(data,input,cancelled,()=>true)).offers[0].verification, undefined);
});
