import { z } from 'zod';
import type { Item, PickupStore } from '../types';
import type { InventoryResult } from './baseScraper';
import { parseProductMetadata, productOfferPrice, productPageURL, readRetailerBody } from './productPageScraper';

const offerSchema = z.object({ sku: z.string().regex(/^[A-Z0-9]{5,12}\/[A-Z](?:\+[a-z0-9-]+)?$/i) });
const storeSchema = z.object({
  storeNumber: z.string().regex(/^R\d+$/),
  storeName: z.string().trim().min(1).max(120),
  retailStore: z.object({
    distance: z.number().finite().nonnegative(),
    distanceUnit: z.enum(['mi', 'km']),
  }),
  partsAvailability: z.record(z.string(), z.object({
    partNumber: z.string(),
    storePickEligible: z.boolean(),
    pickupDisplay: z.enum(['available', 'unavailable', 'ineligible']),
  })),
});
const responseSchema = z.object({
  head: z.object({ status: z.union([z.literal('200'), z.literal(200)]) }),
  body: z.unknown(),
});
const storesSchema = z.object({
  stores: z.array(storeSchema).min(1).max(500),
  location: z.string(),
});

export function applePickupProduct(html: string, page: URL): { part: string; price: number | null } {
  const product = parseProductMetadata(html, page);
  if (typeof product.url !== 'string') throw new Error('Apple must identify the exact configured product URL');
  const offers: unknown[] = Array.isArray(product.offers) ? product.offers : [product.offers];
  if (offers.length !== 1) throw new Error('Apple pickup requires one exact product configuration');
  const offer = offerSchema.passthrough().parse(offers[0]);
  return { part: offer.sku, price: productOfferPrice(offer) };
}

export function parseApplePickup(data: unknown, part: string, zip: string, radius: number): PickupStore[] {
  const response = responseSchema.parse(data);
  const direct = storesSchema.safeParse(response.body);
  const body = direct.success ? direct.data : z.object({
    content: z.object({ pickupMessage: storesSchema }),
  }).parse(response.body).content.pickupMessage;
  if (body.location !== zip) throw new Error('Apple returned pickup results for a different ZIP code');
  const ids = new Set<string>();
  const stores: PickupStore[] = [];
  for (const store of body.stores) {
    if (ids.has(store.storeNumber)) throw new Error('Apple returned duplicate pickup stores');
    ids.add(store.storeNumber);
    const stock = store.partsAvailability[part];
    if (!stock || stock.partNumber !== part) throw new Error('Apple did not return pickup availability for the exact configured product');
    const distance = store.retailStore.distanceUnit === 'mi' ? store.retailStore.distance : store.retailStore.distance / 1.609344;
    if (distance > radius) continue;
    stores.push({
      id: store.storeNumber, name: store.storeName, distance_miles: distance,
      available: stock.storePickEligible && stock.pickupDisplay === 'available',
    });
  }
  return stores.sort((a, b) => a.distance_miles - b.distance_miles || a.id.localeCompare(b.id));
}

export async function checkApplePickup(item: Item, fetcher: typeof fetch = fetch): Promise<InventoryResult> {
  const radius = item.pickup_radius_miles;
  if (!item.pickup_zip || !/^\d{5}$/.test(item.pickup_zip)
      || radius === null || !Number.isInteger(radius) || radius < 1 || radius > 250) {
    throw new Error('Apple pickup requires a five-digit ZIP code and a radius from 1 to 250 miles');
  }
  const page = productPageURL(item);
  const response = await fetcher(page, {
    signal: AbortSignal.timeout(15000), redirect: 'error',
    headers: { Accept: 'text/html', 'User-Agent': 'InventoryChecker/1.0' },
  });
  if (!response.ok) throw new Error(`Apple product page returned HTTP ${response.status}; pickup availability was not checked`);
  const { part, price } = applePickupProduct(await readRetailerBody(response, 'text/html'), page);
  const url = new URL('https://www.apple.com/shop/fulfillment-messages');
  url.search = new URLSearchParams({ fae: 'true', pl: 'true', location: item.pickup_zip, 'parts.0': part }).toString();
  const pickup = await fetcher(url, {
    signal: AbortSignal.timeout(15000), redirect: 'error',
    headers: { Accept: 'application/json', 'User-Agent': 'InventoryChecker/1.0' },
  });
  if (!pickup.ok) throw new Error(`Apple pickup returned HTTP ${pickup.status}; automated pickup access may be blocked. Pickup availability is unknown.`);
  const stores = parseApplePickup(JSON.parse(await readRetailerBody(pickup, 'application/json')), part, item.pickup_zip, radius);
  return { price, in_stock: stores.some(store => store.available), pickup_stores: stores };
}
