import test from 'node:test';
import assert from 'node:assert/strict';
import { checkInventory } from '../src/scrapers/index.js';
import { parseProductPage, productPageURL } from '../src/scrapers/productPageScraper.js';
import { parseAmazonPage } from '@inventory-checker/core';
import type { Item } from '../src/database/models/TrackedItem.js';

const item: Item = {
  id: 'fixture', user_id: 'owner', retailer: 'amazon', sku: null, brand: null, model: null,
  url: 'https://www.amazon.com/name/dp/B0CL61F39H?ref=tracking',
  target_price: null, current_price: null, in_stock: null, last_checked_at: null, last_check_error: null,
  notify_stock: true, notify_price: false,
  fulfillment: 'shipping', pickup_zip: null, pickup_radius_miles: null, pickup_stores: [],
};
const page = new URL('https://www.amazon.com/dp/B0CL61F39H');
const offer = { '@type': 'Offer', price: '499.99', priceCurrency: 'USD', availability: 'https://schema.org/InStock' };
const html = (data: unknown) => `<html><script type="application/ld+json">${JSON.stringify(data)}</script></html>`;
const product = (offers: unknown = offer) => ({ '@type': 'Product', offers });

test('all public-page adapters use fixed HTTPS retailer hosts, canonical product paths, and no redirects', async () => {
  for (const source of [
    { ...item },
    { ...item, retailer: 'target' as const, url: 'https://www.target.com/p/playstation/-/A-90011854?ref=test' },
    { ...item, retailer: 'apple' as const, url: 'https://www.apple.com/shop/product/mx2d3am/a/apple-pencil-pro' },
  ]) {
    let calls = 0;
    const fetcher: typeof fetch = async (input, init) => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.search, '');
      assert.equal(url.protocol, 'https:');
      assert.equal(init?.redirect, 'error');
      assert.ok(init?.signal);
      assert.equal(url.href, productPageURL(source).href);
      return new Response(html(product()), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    };
    assert.deepEqual(await checkInventory(source, undefined, fetcher), { price: 499.99, in_stock: true });
    assert.equal(calls, 1);
  }
});

test('retailer URL validation prevents arbitrary hosts, credentials, ports, schemes, and non-product pages', () => {
  for (const url of [
    'http://www.amazon.com/dp/B0CL61F39H', 'https://127.0.0.1/dp/B0CL61F39H',
    'https://www.amazon.com.evil.example/dp/B0CL61F39H',
    'https://user:pass@www.amazon.com/dp/B0CL61F39H',
    'https://www.amazon.com:444/dp/B0CL61F39H', 'https://www.amazon.com/s?k=ps5',
    'https://www.amazon.com/dp/../../internal',
  ]) assert.throws(() => productPageURL({ ...item, url }));
  assert.throws(() => productPageURL({ ...item, retailer: 'apple', url: 'https://www.apple.com/shop/buy-iphone/iphone-17' }), /specific/);
  assert.throws(() => productPageURL({ ...item, retailer: 'target', url: 'https://www.target.com/s?searchTerm=ps5' }), /TCIN/);
  assert.equal(productPageURL({ ...item, url: null, sku: 'B0CL61F39H' }).href, page.href);
  assert.equal(productPageURL({ ...item, retailer: 'target', url: null, sku: '90011854' }).pathname, '/p/-/A-90011854');
});

test('stock-only data works without a price and never invents stock or a zero price', () => {
  for (const status of ['OutOfStock', 'SoldOut', 'Discontinued', 'PreOrder', 'PreSale', 'BackOrder']) {
    assert.deepEqual(parseProductPage(html(product({ availability: `http://schema.org/${status}` })), page),
      { price: null, in_stock: false });
  }
  assert.deepEqual(parseProductPage(html(product({ availability: 'InStock' })), page), { price: null, in_stock: true });
  assert.deepEqual(parseProductPage(html(product({ ...offer, price: 0 })), page), { price: 0, in_stock: true });
  for (const availability of [undefined, 'unknown', 'OnlineOnly', 'https://evil.example/InStock']) {
    assert.throws(() => parseProductPage(html(product({ ...offer, availability })), page), /stock status/);
  }
});

test('blocked, malformed, missing, unrelated and ambiguous product data fails explicitly', () => {
  assert.throws(() => parseProductPage('<html>Verify you are human</html>', page), /blocked/);
  assert.throws(() => parseProductPage('<script type="application/ld+json">{bad}</script>', page), /malformed/);
  assert.throws(() => parseProductPage(html(product([])), page), /no offers/);
  assert.throws(() => parseProductPage(html(product({ '@type': 'AggregateOffer', lowPrice: 99 })), page), /stock status/);
  assert.throws(() => parseProductPage(html([product(), product()]), page), /unambiguous/);
  assert.throws(() => parseProductPage(html({ ...product(), url: 'https://www.amazon.com/dp/B000000000' }), page), /does not match/);
  assert.throws(() => parseProductPage(html(product([offer, { ...offer, availability: 'OutOfStock' }])), page), /multiple offers/);
  for (const price of [-1, 'free', '', '1,000', 10000000000]) {
    assert.throws(() => parseProductPage(html(product({ ...offer, price })), page), /invalid price/);
  }
  assert.throws(() => parseProductPage(html(product({ ...offer, priceCurrency: 'CAD' })), page), /USD/);
  assert.deepEqual(parseProductPage(html({ '@graph': [product()] }), page), { price: 499.99, in_stock: true });
});

test('Target metadata can use its full slug for the same TCIN', () => {
  const target = new URL('https://www.target.com/p/-/A-90011854');
  assert.deepEqual(parseProductPage(html({ ...product(), url: 'https://www.target.com/p/playstation/-/A-90011854' }), target),
    { price: 499.99, in_stock: true });
});

test('Target preselect checks only the selected variant and discards tracking', async () => {
  const source = { ...item, retailer: 'target' as const,
    url: 'https://www.target.com/p/apple-macbook-neo-a18-pro-2026-laptop/-/A-95288385?preselect=91122045#lnk=sametab' };
  const selected = 'https://www.target.com/p/-/A-91122045';
  assert.equal(productPageURL(source).href, selected);
  let calls = 0;
  const result = await checkInventory(source, undefined, async (input, init) => {
    calls++;
    assert.equal(String(input), selected);
    assert.equal(init?.redirect, 'error');
    return new Response(html({ ...product(), url: 'https://www.target.com/p/laptop-256gb-blush/-/A-91122045' }),
      { headers: { 'content-type': 'text/html' } });
  });
  assert.deepEqual(result, { price: 499.99, in_stock: true });
  assert.equal(calls, 1);
  await assert.rejects(checkInventory(source, undefined, async () =>
    new Response(html({ ...product(), url: 'https://www.target.com/p/laptop/-/A-95288385' }),
      { headers: { 'content-type': 'text/html' } })), /does not match/);
  for (const query of ['preselect=', 'preselect=abc', 'preselect=123', 'preselect=91122045&preselect=91122081']) {
    await assert.rejects(checkInventory({ ...source, url: `https://www.target.com/p/-/A-95288385?${query}` },
      undefined, async () => { assert.fail('Invalid variants must not be fetched'); }), /preselect/);
  }
});

test('Target dynamic pages report an explicit limitation rather than inventing stock', async () => {
  const source = { ...item, retailer: 'target' as const, url: 'https://www.target.com/p/-/A-91122045' };
  await assert.rejects(checkInventory(source, undefined, async () =>
    new Response('<html><title>Laptop</title><script id="__NEXT_DATA__" type="application/json">'
      + '{"item":{"tcin":"91122045","eligibility_rules":{"ship_to_guest":{"is_active":true}}}}</script></html>',
    { headers: { 'content-type': 'text/html' } })), /Target TCIN 91122045.*public HTML/);
  await assert.rejects(checkInventory(source, undefined, async () =>
    new Response('<script type="application/ld+json">{broken}</script>',
      { headers: { 'content-type': 'text/html' } })), /malformed/);
});

test('HTTP errors, non-HTML pages and oversized bodies are not successful checks', async () => {
  for (const response of [
    new Response('Denied', { status: 403 }),
    Response.json(product()),
    new Response('x'.repeat(4 * 1024 * 1024 + 1), { headers: { 'content-type': 'text/html' } }),
  ]) await assert.rejects(checkInventory(item, undefined, async () => response));
});

const amazonHTML = (availability = 'In Stock', asin = 'B0CL61F39H', price = '$499.99') =>
  `<input id="ASIN" value="${asin}">
   <div id="availability"><span class="primary-availability-message">${availability}</span><script>{"notStock":true}</script></div>
   <div id="corePriceDisplay_desktop_feature_div"><span class="a-price"><span class="a-offscreen">${price}</span></span></div>`;

test('Amazon public HTML validates exact ASIN, primary stock, and current USD price without JSON-LD', () => {
  assert.deepEqual(parseAmazonPage(amazonHTML(), page), { price: 499.99, in_stock: true });
  assert.deepEqual(parseAmazonPage(amazonHTML('Only 3 left in stock - order soon.'), page), { price: 499.99, in_stock: true });
  assert.deepEqual(parseAmazonPage(amazonHTML('Currently unavailable.'), page), { price: 499.99, in_stock: false });
  assert.deepEqual(parseAmazonPage(amazonHTML()
    + '<div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen"> </span></span>'
    + '<span class="a-price a-text-price"><span class="a-offscreen">$999.99</span></span></div>', page),
  { price: 499.99, in_stock: true });
  assert.deepEqual(parseAmazonPage(amazonHTML().replace(/<div id="corePriceDisplay[\s\S]*/, ''), page), { price: null, in_stock: true });
  for (const source of [
    amazonHTML('Ships in 2 weeks'), amazonHTML('In Stock', 'B000000000'), amazonHTML('In Stock', undefined, 'CDN$499.99'),
    amazonHTML() + '<input id="ASIN" value="B000000000">',
    amazonHTML().replace('</div>', '</div><div id="availability">In Stock</div>'),
    '<input id="captchacharacters"><div>Verify you are human</div>',
    amazonHTML() + '<script type="application/ld+json">{broken}</script>',
    amazonHTML() + '<div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">$9.99</span></span></div>',
  ]) assert.throws(() => parseAmazonPage(source, page));
});

test('Amazon share links resolve once, validate the destination, and strip tracking before fetching', async () => {
  const requests: string[] = [];
  const result = await checkInventory({ ...item, url: 'https://a.co/d/fixture?tracking=yes' }, undefined, async (input, init) => {
    requests.push(String(input));
    assert.ok(init?.signal);
    if (requests.length === 1) {
      assert.equal(init?.redirect, 'manual');
      return new Response(null, { status: 301, headers: { location: 'https://www.amazon.com/dp/B0CL61F39H?ref=tracking' } });
    }
    assert.equal(init?.redirect, 'error');
    return new Response(amazonHTML(), { headers: { 'content-type': 'text/html' } });
  });
  assert.deepEqual(result, { price: 499.99, in_stock: true });
  assert.deepEqual(requests, ['https://a.co/d/fixture', page.href]);
});

test('Amazon share links reject invalid redirects and failures without fetching unsafe destinations', async () => {
  for (const location of [
    'http://www.amazon.com/dp/B0CL61F39H', 'https://127.0.0.1/', 'https://www.amazon.com.evil.example/dp/B0CL61F39H',
    'https://www.amazon.com:444/dp/B0CL61F39H', 'https://www.amazon.com/s?k=mouse', 'https://a.co/d/another',
  ]) {
    let calls = 0;
    await assert.rejects(checkInventory({ ...item, url: 'https://a.co/d/fixture' }, undefined, async () => {
      calls++;
      return new Response(null, { status: 302, headers: { location } });
    }));
    assert.equal(calls, 1);
  }
  await assert.rejects(checkInventory({ ...item, url: 'https://a.co/d/fixture' }, undefined,
    async () => new Response(null, { status: 404 })), /short link did not resolve/);
  for (const url of ['http://a.co/d/fixture', 'https://a.co:444/d/fixture', 'https://a.co/not-a-product']) {
    await assert.rejects(checkInventory({ ...item, url }, undefined, async () => { assert.fail('Invalid URL must not be fetched'); }));
  }
});
