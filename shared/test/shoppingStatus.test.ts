import test from 'node:test';
import assert from 'node:assert/strict';
import { matchShoppingCards, shoppingProductStatus, shoppingSellerEvidence, visibleShoppingOffers, groupShoppingOffers,
  type ShoppingOffer, type ShoppingSearch } from '../src/index.js';

const input = { product: 'MacBook Neo', variants: ['256GB', 'Indigo'] };
const offer = (text: string, title = 'MacBook Neo 256GB Indigo') => matchShoppingCards([{
  title, text, price: '$699.00', seller: 'Target', url: 'https://www.target.com/p/laptop/-/A-91122045',
}], input)[0];
const status = (offers: ShoppingOffer[]) => shoppingProductStatus({
  id: 'fixture', input, checked_at: '2026-11-08T00:00:00Z', error: null, offers,
} satisfies ShoppingSearch);

test('lowest found uses current matching listed prices without implying availability or a sale', () => {
  assert.equal(shoppingProductStatus(null).lowestPrice, null);
  assert.equal(status([]).lowestPrice, null);
  const matches = [
    { ...offer('In stock'), price: '$1,299.99' },
    { ...offer('Out of stock'), price: '$649.95' },
    { ...offer('Free shipping'), price: '$699' },
    { ...offer('', 'Case for MacBook Neo 256GB Indigo'), price: '$9.99' },
    { ...offer(''), price: 'Price unavailable' },
  ];
  assert.equal(status(matches).lowestPrice, 649.95);
  assert.equal(status(matches).sale, false);
  assert.equal(status([{ ...offer(''), price: 'Price unavailable' }]).lowestPrice, null);
  assert.equal(status([{ ...offer(''), price: '$0.00' }]).lowestPrice, 0);
});

test('product stock tags aggregate only exact text matches and preserve unknown inventory', () => {
  assert.equal(shoppingProductStatus(null).stock, 'unknown');
  assert.equal(status([]).stock, 'unknown');
  assert.equal(status([offer('Out of stock')]).stock, 'out-of-stock');
  assert.equal(status([offer('Out of stock'), offer('Free shipping')]).stock, 'unknown');
  assert.equal(status([offer('Out of stock'), offer('In stock')]).stock, 'in-stock');
  assert.equal(status([offer('In stock', 'Case for MacBook Neo 256GB Indigo')]).stock, 'unknown');
  assert.equal(status([offer('In stock\nOut of stock')]).stock, 'unknown');
});

test('retailer stock takes precedence without turning failed verification into stock evidence', () => {
  const reported = offer('In stock');
  assert.equal(status([{ ...reported, verification: { status: 'verified', message: 'Observed', in_stock: false } }]).stock, 'out-of-stock');
  assert.equal(status([{ ...offer('Free shipping'), verification: { status: 'verified', message: 'Observed', in_stock: true } }]).stock, 'in-stock');
  assert.equal(status([{ ...reported, verification: { status: 'failed', message: 'Blocked' } }]).stock, 'in-stock');
  assert.equal(status([{ ...offer('Free shipping'), verification: { status: 'failed', message: 'Blocked' } }]).stock, 'unknown');
});

test('sale tags require explicit source labels on required-text matches', () => {
  for (const label of ['On sale', 'Sale', '20% off', 'Save $50.00', 'Save 15%', 'Sale price: $699.00']) {
    assert.equal(offer(label).sale_text, label);
    assert.equal(status([offer(label)]).sale, true);
  }
  for (const text of ['Free shipping', 'Best price', 'For sale', 'Wholesale', 'No sale', 'Save with a subscription', '20% off accessories']) {
    assert.equal(offer(text).sale_text, undefined);
    assert.equal(status([offer(text)]).sale, false);
  }
  assert.equal(status([offer('On sale', 'MacBook Neo 512GB Indigo')]).sale, false);
});

test('seller evidence distinguishes domains, names, and verification without trusting spoofed destinations', () => {
  const base = offer('');
  assert.equal(shoppingSellerEvidence(base).label, 'Recognized retailer domain');
  assert.equal(shoppingSellerEvidence({ ...base, verification: { status: 'verified', message: 'Observed' } }).level, 'verified');
  assert.equal(shoppingSellerEvidence({ ...base, url: 'https://www.google.com/aclk?adurl=' }).label, 'Recognized seller name only');
  assert.equal(shoppingSellerEvidence({ ...base, url: 'https://www.google.com/url?q=https%3A%2F%2Fwww.target.com%2Fp%2Fitem' }).label, 'Recognized retailer domain');
  for (const url of ['https://target.com.fake.com', 'https://fake-target.com', 'http://target.com',
    'https://target.com:8443', 'https://user@target.com', 'broken',
    'https://www.google.com/aclk?adurl=https%3A%2F%2Ffake.com']) {
    assert.equal(shoppingSellerEvidence({ ...base, url }).level, 'unassessed', url);
  }
  assert.equal(shoppingSellerEvidence({ ...base, seller: 'Unknown shop', url: 'https://www.google.com/goto?url=opaque' }).level, 'unassessed');
});

test('offer views sort numeric prices stably, place missing prices last, and do not mutate results', () => {
  const base = offer('');
  const offers = [
    { ...base, price: '$1,099.00' },
    { ...base, price: '$99.00', url: 'https://unknown-shop.com/item' },
    { ...base, price: 'Unavailable' },
    { ...base, price: '$99.00', verification: { status: 'verified' as const, message: 'Observed' } },
  ];
  assert.deepEqual(visibleShoppingOffers(offers, { sort: 'price-asc', seller: 'all' }), [offers[1], offers[3], offers[0], offers[2]]);
  assert.deepEqual(visibleShoppingOffers(offers, { sort: 'price-desc', seller: 'all' }), [offers[0], offers[1], offers[3], offers[2]]);
  assert.deepEqual(visibleShoppingOffers(offers, { sort: 'source', seller: 'verified' }), [offers[3]]);
  assert.deepEqual(visibleShoppingOffers(offers, { sort: 'source', seller: 'recognized' }), [offers[0], offers[2], offers[3]]);
  assert.deepEqual(visibleShoppingOffers(offers, { sort: 'source', seller: 'unassessed' }), [offers[1]]);
  assert.equal(offers[0].price, '$1,099.00');
});

test('vendor grouping combines seller aliases and retains every listing in sorted order', () => {
  const base = offer('');
  const offers = [
    { ...base, seller: 'Apple Education Store', price: '$799.00' },
    { ...base, seller: 'Apple', price: '$699.00' },
    { ...base, seller: ' Target ', price: '$749.00' },
    { ...base, seller: 'target', price: '$849.00' },
    { ...base, seller: 'Apple accessories shop', price: '$899.00' },
  ];
  const groups = groupShoppingOffers(visibleShoppingOffers(offers, { sort: 'price-asc', seller: 'all' }));
  assert.deepEqual(groups.map(group => group.vendor), ['Apple', 'Target', 'Apple accessories shop']);
  assert.deepEqual(groups[0].offers.map(offer => offer.price), ['$699.00', '$799.00']);
  assert.equal(groups[1].offers.length, 2);
  assert.equal(groups.flatMap(group => group.offers).length, offers.length);
  assert.deepEqual(groupShoppingOffers([]), []);
  assert.equal(offers[0].seller, 'Apple Education Store');
});

test('price sorting ranks vendors by their minimum price independently of listing direction', () => {
  const base = offer('');
  const offers = [
    { ...base, seller: 'eBay', price: '$2,099.00' },
    { ...base, seller: 'eBay', price: '$2,599.00' },
    { ...base, seller: 'eBay', price: '$2,989.00' },
    { ...base, seller: 'Apple', price: '$1,999.00' },
    { ...base, seller: 'Apple', price: '$1,999.00' },
    { ...base, seller: 'Missing price', price: 'Unavailable' },
  ];
  for (const sort of ['price-asc', 'price-desc'] as const) {
    const groups = groupShoppingOffers(visibleShoppingOffers(offers, { sort, seller: 'all' }), sort);
    assert.deepEqual(groups.map(group => group.vendor), ['Apple', 'eBay', 'Missing price']);
    assert.deepEqual(groups.map(group => group.lowestPrice), [1999, 2099, null]);
    assert.deepEqual(groups[1].offers.map(offer => offer.price),
      sort === 'price-asc' ? ['$2,099.00', '$2,599.00', '$2,989.00'] : ['$2,989.00', '$2,599.00', '$2,099.00']);
  }
  assert.deepEqual(groupShoppingOffers(offers).map(group => group.vendor), ['eBay', 'Apple', 'Missing price']);
});
