import type { Item } from '../types';
import type { InventoryResult, Scraper } from './baseScraper';

type PageRetailer = Exclude<Item['retailer'], 'bestbuy'>;
const hosts: Record<PageRetailer, string> = {
  amazon: 'www.amazon.com', target: 'www.target.com', apple: 'www.apple.com',
};
const maxPageBytes = 4 * 1024 * 1024;

export function productPageURL(item: Item): URL {
  if (item.retailer === 'bestbuy') throw new Error('Best Buy uses its product API');
  const host = hosts[item.retailer];
  let source: URL | undefined;
  if (item.url) {
    source = new URL(item.url);
    if (source.protocol !== 'https:' || ![host, host.replace('www.', '')].includes(source.hostname)
        || source.username || source.password || source.port) {
      throw new Error(`Use an HTTPS product URL on ${host}`);
    }
  }
  const path = source?.pathname;
  if (item.retailer === 'amazon') {
    const asin = path ? /\/(?:dp|gp\/product)\/([a-z0-9]{10})(?:\/|$)/i.exec(path)?.[1] : item.sku;
    if (!asin || !/^[a-z0-9]{10}$/i.test(asin)) throw new Error('Amazon requires a product URL containing /dp/ASIN or a 10-character ASIN');
    return new URL(`https://${host}/dp/${asin.toUpperCase()}`);
  }
  if (item.retailer === 'target') {
    const parent = path ? /\/p\/.*\/-\/A-(\d{5,12})\/?$/i.exec(path)?.[1]
      ?? /^\/p\/-\/A-(\d{5,12})\/?$/i.exec(path)?.[1] : item.sku;
    if (!parent || !/^\d{5,12}$/.test(parent)) throw new Error('Target requires a product URL ending in /-/A-TCIN or a numeric TCIN');
    const selected = source?.searchParams.getAll('preselect') ?? [];
    if (selected.length > 1 || selected.some(value => !/^\d{5,12}$/.test(value))) {
      throw new Error('Target preselect must identify one numeric product TCIN');
    }
    const tcin = selected[0] ?? parent;
    return new URL(`https://${host}/p/-/A-${tcin}`);
  }
  const part = path && /^\/shop\/product\/([a-z0-9]+\/[a-z0-9]+)(?:\/[a-z0-9-]+)?\/?$/i.exec(path)?.[1];
  const configuration = item.fulfillment === 'pickup' && path
    && /^\/shop\/buy-[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9][a-z0-9.-]+\/?$/i.test(path);
  if (!part && !configuration) throw new Error('Apple requires a specific /shop/product/ URL, or an exact /shop/buy- configuration URL with pickup tracking');
  return new URL(`https://${host}${path}`);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function products(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(products);
  if (!object(value)) return [];
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.includes('Product')) return [value];
  return [...products(value['@graph']), ...products(value.mainEntity)];
}

export function productOfferPrice(value: Record<string, unknown>): number | null {
  if (value.price === undefined || value.price === null) return null;
  if (value.priceCurrency !== 'USD') throw new Error('Only USD product prices are supported');
  if (typeof value.price !== 'number' && !(typeof value.price === 'string' && /^\d+(?:\.\d{1,2})?$/.test(value.price))) {
    throw new Error('Product page returned an invalid price');
  }
  const price = Number(value.price);
  if (!Number.isFinite(price) || price < 0 || price > 9999999999.99) throw new Error('Product page returned an invalid price');
  return price;
}

function offerResult(value: unknown): InventoryResult {
  if (!object(value)) throw new Error('Product page has no usable offer');
  const availability = typeof value.availability === 'string'
    ? value.availability.replace(/^https?:\/\/schema\.org\//, '') : undefined;
  const available = availability === 'InStock' || availability === 'LimitedAvailability';
  const unavailable = ['OutOfStock', 'SoldOut', 'Discontinued', 'PreOrder', 'PreSale', 'BackOrder'].includes(availability ?? '');
  if (!available && !unavailable) throw new Error('Product page does not publish a recognized stock status');
  return { price: productOfferPrice(value), in_stock: available };
}

function productIdentity(url: URL): string {
  const path = url.pathname.replace(/\/$/, '');
  if (url.hostname === hosts.amazon) return /\/(?:dp|gp\/product)\/([a-z0-9]{10})(?:\/|$)/i.exec(path)?.[1].toUpperCase() ?? path;
  if (url.hostname === hosts.target) return /\/A-(\d+)$/i.exec(path)?.[1] ?? path;
  if (url.hostname === hosts.apple) return /^\/shop\/product\/([^/]+\/[^/]+)/i.exec(path)?.[1].toLowerCase() ?? path;
  return path;
}

export function parseProductMetadata(html: string, page: URL): Record<string, unknown> {
  const found: Record<string, unknown>[] = [];
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(script[1])) continue;
    let data: unknown;
    try { data = JSON.parse(script[2]); }
    catch (error) { throw new Error('Product page returned malformed product metadata', { cause: error }); }
    found.push(...products(data));
  }
  if (found.length !== 1) throw new Error('Page must publish one unambiguous product with stock data; it may be blocked or require an authorized retailer integration');
  const product = found[0];
  if (typeof product.url === 'string') {
    const actual = new URL(product.url, page);
    if (actual.origin !== page.origin || productIdentity(actual) !== productIdentity(page)) {
      throw new Error('Product metadata does not match the requested product URL');
    }
  }
  return product;
}

export function parseProductPage(html: string, page: URL): InventoryResult {
  const product = parseProductMetadata(html, page);
  const offers: unknown[] = Array.isArray(product.offers) ? product.offers : [product.offers];
  if (!offers.length) throw new Error('Product page has no offers');
  const results = offers.map(offerResult);
  const first = results[0];
  if (results.some(result => result.price !== first.price || result.in_stock !== first.in_stock)) {
    throw new Error('Product has multiple offers or variants; a specific product offer is required');
  }
  return first;
}

export async function readRetailerBody(response: Response, contentType: 'text/html' | 'application/json'): Promise<string> {
  if (!response.headers.get('content-type')?.includes(contentType)) throw new Error(`Retailer did not return ${contentType} data`);
  if (!response.body) throw new Error('Retailer returned an empty product page');
  if (typeof response.body.getReader !== 'function') {
    const text = await response.text();
    if (text.length > maxPageBytes || new TextEncoder().encode(text).byteLength > maxPageBytes) {
      throw new Error('Retailer product page exceeds the 4 MB limit');
    }
    return text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxPageBytes) {
        await reader.cancel();
        throw new Error('Retailer product page exceeds the 4 MB limit');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

export async function fetchProductHTML(url: URL, retailer: PageRetailer, fetcher: typeof fetch): Promise<string> {
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(15000), redirect: 'error',
    headers: { Accept: 'text/html', 'User-Agent': 'InventoryChecker/1.0' },
  });
  if (!response.ok) throw new Error(`${retailer} returned HTTP ${response.status}; product availability was not checked`);
  return readRetailerBody(response, 'text/html');
}

export function productPageScraper(retailer: PageRetailer, fetcher: typeof fetch = fetch): Scraper {
  return {
    async check(item) {
      if (item.retailer !== retailer) throw new Error('Retailer adapter mismatch');
      const url = productPageURL(item);
      return parseProductPage(await fetchProductHTML(url, retailer, fetcher), url);
    },
  };
}
