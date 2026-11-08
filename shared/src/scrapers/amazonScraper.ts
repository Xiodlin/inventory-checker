import { DomUtils, parseDocument } from 'htmlparser2';
import { fetchProductHTML, parseProductPage, productPageURL } from './productPageScraper';
import type { Item } from '../types';
import type { InventoryResult, Scraper } from './baseScraper';

export function parseAmazonPage(html: string, page: URL): InventoryResult {
  if (/\btype\s*=\s*["']application\/ld\+json["']/i.test(html)) return parseProductPage(html, page);
  const document = parseDocument(html);
  const byId = (id: string) => DomUtils.findAll(node => node.attribs.id === id, document);
  if (byId('captchacharacters').length || /<title[^>]*>\s*(?:Amazon\s+)?Robot Check/i.test(html)) {
    throw new Error('Amazon returned a verification page; availability could not be checked');
  }
  const asin = page.pathname.split('/')[2];
  const identities = byId('ASIN');
  if (!identities.length || identities.some(node => node.attribs.value !== asin)) {
    throw new Error('Amazon page does not identify the exact requested ASIN; availability is unknown');
  }
  const containers = byId('availability');
  if (containers.length !== 1) throw new Error('Amazon page has no unambiguous product availability');
  const messages = DomUtils.findAll(node => node.name === 'span'
    && (node.attribs.class ?? '').split(/\s+/).includes('primary-availability-message'), containers[0]);
  const text = DomUtils.textContent(messages.length === 1 ? messages[0] : containers[0])
    .replace(/\s+/g, ' ').trim();
  const inStock = /^In Stock\.?$/i.test(text) || /^Only \d+ left in stock(?:\s*[-\u2013]\s*order soon)?\.?$/i.test(text);
  const outOfStock = /^(?:Currently unavailable\.?|Out of stock\.?|Temporarily out of stock\.?)(?: We don't know when or if this item will be back in stock\.?)?$/i.test(text);
  if (!inStock && !outOfStock) throw new Error('Amazon page does not publish a recognized product stock status');
  const priceContainers = [...byId('corePriceDisplay_desktop_feature_div'), ...byId('corePrice_feature_div')];
  const prices = priceContainers.flatMap(container => DomUtils.findAll(node =>
    (node.attribs.class ?? '').split(/\s+/).includes('a-price')
      && !(node.attribs.class ?? '').split(/\s+/).includes('a-text-price'), container))
    .flatMap(container => DomUtils.findAll(node => (node.attribs.class ?? '').split(/\s+/).includes('a-offscreen'), container))
    .map(node => DomUtils.textContent(node).trim()).filter(Boolean);
  let price: number | null = null;
  if (prices.length) {
    if (new Set(prices).size !== 1 || !/^\$\d+(?:,\d{3})*(?:\.\d{2})?$/.test(prices[0])) {
      throw new Error('Amazon page has ambiguous prices or a non-USD price');
    }
    price = Number(prices[0].replace(/[$,]/g, ''));
    if (!Number.isFinite(price) || price > 9999999999.99) throw new Error('Amazon page returned an invalid price');
  }
  return { price, in_stock: inStock };
}

async function amazonURL(item: Item, fetcher: typeof fetch): Promise<URL> {
  if (item.retailer !== 'amazon') throw new Error('Retailer adapter mismatch');
  if (!item.url || new URL(item.url).hostname !== 'a.co') return productPageURL(item);
  const short = new URL(item.url);
  if (short.protocol !== 'https:' || short.username || short.password
      || short.port || !/^\/d\/[a-z0-9]+\/?$/i.test(short.pathname)) {
    throw new Error('Use an HTTPS Amazon share link like https://a.co/d/…, or a full amazon.com/dp/ASIN URL');
  }
  short.search = ''; short.hash = '';
  const response = await fetcher(short, { redirect: 'manual', signal: AbortSignal.timeout(15000),
    headers: { Accept: 'text/html', 'User-Agent': 'InventoryChecker/1.0' } });
  try {
    const location = response.headers.get('location');
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) {
      throw new Error(`Amazon short link did not resolve (HTTP ${response.status}). Open it in your browser and use the full amazon.com/dp/ASIN URL.`);
    }
    // Validate and canonicalize the destination before making the product request.
    return productPageURL({ ...item, url: new URL(location, short).href });
  } finally { await response.body?.cancel(); }
}

export const amazonScraper = (fetcher: typeof fetch = fetch): Scraper => ({
  async check(item) {
    const url = await amazonURL(item, fetcher);
    return parseAmazonPage(await fetchProductHTML(url, 'amazon', fetcher), url);
  },
});
