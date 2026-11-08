import { productPageScraper } from './productPageScraper';
import { checkApplePickup } from './applePickupScraper';
import type { Scraper } from './baseScraper';
export const appleScraper = (fetcher: typeof fetch = fetch): Scraper => ({
  check: item => item.fulfillment === 'pickup'
    ? checkApplePickup(item, fetcher) : productPageScraper('apple', fetcher).check(item),
});
