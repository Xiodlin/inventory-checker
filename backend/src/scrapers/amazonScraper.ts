import { NotConfiguredError, type Scraper } from './baseScraper.js';
// Requires an approved Amazon API integration; supplied URLs are never fetched.
export const amazonScraper: Scraper = {
  async check() { throw new NotConfiguredError('amazon'); },
};
