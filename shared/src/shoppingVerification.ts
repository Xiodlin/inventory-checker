import { DomUtils, parseDocument } from 'htmlparser2';
import { matchShoppingCards, isPublicShoppingURL, type ShoppingInput, type ShoppingSearch } from './shopping';
import { productPageURL, fetchProductHTML, parseProductMetadata, parseProductPage } from './scrapers/productPageScraper';
import { parseAmazonPage } from './scrapers/amazonScraper';
import type { Item } from './types';

function retailerItem(value: string): Item {
  const url = new URL(value);
  if (!isPublicShoppingURL(value)) throw new Error('Unsupported retailer destination');
  const retailers = { 'amazon.com': 'amazon', 'target.com': 'target', 'apple.com': 'apple' } as const;
  const host = url.hostname.replace(/^www\./, '');
  if (!(host in retailers)) throw new Error('This seller has no supported public-page verifier');
  const retailer = retailers[host as keyof typeof retailers];
  const item: Item = { id: '', user_id: 'local', retailer, brand: null, model: null, sku: null, url: value,
    target_price: null, current_price: null, in_stock: null, notify_stock: false, notify_price: false,
    fulfillment: 'shipping', pickup_zip: null, pickup_radius_miles: null, pickup_stores: [],
    last_checked_at: null, last_check_error: null };
  productPageURL(item);
  return item;
}
export async function verifyShoppingOffers(result: ShoppingSearch, input: ShoppingInput,
  fetcher: typeof fetch = fetch, cancelled: () => boolean = () => false): Promise<ShoppingSearch> {
  if (result.error) return result;
  const offers = result.offers.map(offer => ({ ...offer }));
  let attempts = 0;
  for (const offer of offers) {
    if (offer.match !== 'text-match') continue;
    if (cancelled()) break;
    try {
      let url = new URL(offer.url);
      if (['www.google.com', 'google.com'].includes(url.hostname)) {
        const direct = url.pathname === '/url' ? url.searchParams.get('url') || url.searchParams.get('q')
          : url.pathname === '/aclk' ? url.searchParams.get('adurl') : null;
        if (direct) url = new URL(direct);
        else {
          offer.verification = { status: 'unsupported', message: 'Google tracking link does not expose a retailer product destination; no ad click was made.' };
          continue;
        }
      }
      let item: Item;
      try { item = retailerItem(url.href); }
      catch (error) {
        offer.verification = { status: 'unsupported', message: error instanceof Error ? error.message : 'Unsupported retailer URL' };
        continue;
      }
      if (attempts >= 2) {
        offer.verification = { status: 'skipped', message: 'Verification limited to two supported required-text offers per check.' };
        continue;
      }
      attempts++;
      const page = productPageURL(item);
      const html = await fetchProductHTML(page, item.retailer as 'amazon' | 'target' | 'apple', fetcher);
      if (cancelled()) break;
      let title: string;
      if (item.retailer === 'amazon' && !/\btype\s*=\s*["']application\/ld\+json["']/i.test(html)) {
        const titles = DomUtils.findAll(node => node.attribs.id === 'productTitle', parseDocument(html));
        if (titles.length !== 1) throw new Error('Retailer does not identify one product title');
        title = DomUtils.textContent(titles[0]).trim();
      } else {
        const metadata = parseProductMetadata(html, page);
        if (typeof metadata.name !== 'string') throw new Error('Retailer product title is missing');
        title = metadata.name;
      }
      const match = matchShoppingCards([{ title, text: title, seller: offer.seller, price: offer.price, url: page.href }], input)[0];
      if (!match || match.match !== 'text-match') throw new Error('Retailer title does not establish all required product/variant phrases');
      const stock = item.retailer === 'amazon' ? parseAmazonPage(html, page) : parseProductPage(html, page);
      offer.verification = { status: 'verified', url: page.href, in_stock: stock.in_stock, price: stock.price,
        message: 'Retailer product page checked; title matches required phrases. This is not exact-SKU or local pickup verification.' };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Retailer verification failed';
      console.warn('Shopping retailer verification failed:', message);
      offer.verification = { status: 'failed', message };
    }
  }
  return { ...result, offers };
}
