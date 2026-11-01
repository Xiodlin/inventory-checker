import { z } from 'zod';
import { NotConfiguredError, type Scraper } from './baseScraper.js';
const productSchema = z.object({
  products: z.array(z.object({ salePrice: z.number().finite().nonnegative().max(9999999999.99), onlineAvailability: z.boolean() })).max(1),
});
export function bestBuyScraper(apiKey?: string, fetcher: typeof fetch = fetch): Scraper {
  return {
    async check(item) {
      if (!apiKey) throw new NotConfiguredError('bestbuy');
      if (!item.sku || !/^\d{1,20}$/.test(item.sku)) throw new Error('Best Buy requires a numeric SKU');
      const url = new URL(`https://api.bestbuy.com/v1/products(sku=${encodeURIComponent(item.sku)})`);
      url.search = new URLSearchParams({ apiKey, format: 'json', show: 'salePrice,onlineAvailability', pageSize: '1' }).toString();
      const response = await fetcher(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok) throw new Error(`Best Buy API returned HTTP ${response.status}`);
      const result = productSchema.parse(await response.json());
      if (!result.products[0]) throw new Error('Best Buy product not found');
      return { price: result.products[0].salePrice, in_stock: result.products[0].onlineAvailability };
    },
  };
}
