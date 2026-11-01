import { NotConfiguredError, type Scraper } from './baseScraper.js';
// Requires an approved Target API integration; supplied URLs are never fetched.
export const targetScraper: Scraper = {
  async check() { throw new NotConfiguredError('target'); },
};
