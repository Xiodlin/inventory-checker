import type { Item } from '../types';
import { amazonScraper } from './amazonScraper';
import { targetScraper } from './targetScraper';
import { appleScraper } from './appleScraper';
import { bestBuyScraper } from './bestBuyScraper';
export async function checkInventory(item: Item, bestBuyKey?: string, fetcher: typeof fetch = fetch) {
  const scrapers = {
    amazon: amazonScraper(fetcher), target: targetScraper(fetcher), apple: appleScraper(fetcher),
    bestbuy: bestBuyScraper(bestBuyKey, fetcher),
  };
  return scrapers[item.retailer].check(item);
}
