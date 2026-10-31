import type { Item } from '../database/models/TrackedItem.js';
import { amazonScraper } from './amazonScraper.js';
import { targetScraper } from './targetScraper.js';
import { appleScraper } from './appleScraper.js';
import { bestBuyScraper } from './bestBuyScraper.js';
export async function checkInventory(item: Item, bestBuyKey?: string, fetcher: typeof fetch = fetch) {
  const scrapers = {
    amazon: amazonScraper, target: targetScraper, apple: appleScraper,
    bestbuy: bestBuyScraper(bestBuyKey, fetcher),
  };
  return scrapers[item.retailer].check(item);
}
