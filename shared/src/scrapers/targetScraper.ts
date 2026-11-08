import { fetchProductHTML, parseProductPage, productPageURL } from './productPageScraper';
import type { Scraper } from './baseScraper';

export const targetScraper = (fetcher: typeof fetch = fetch): Scraper => ({
  async check(item) {
    if (item.retailer !== 'target') throw new Error('Retailer adapter mismatch');
    const url = productPageURL(item);
    const html = await fetchProductHTML(url, 'target', fetcher);
    if (!/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["']/i.test(html)) {
      throw new Error(`Target TCIN ${url.pathname.split('A-')[1]} does not publish stock/price metadata in its public HTML. Dynamic or blocked pages cannot be checked by this adapter; availability remains unknown.`);
    }
    return parseProductPage(html, url);
  },
});
