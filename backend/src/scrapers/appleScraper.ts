import { NotConfiguredError, type Scraper } from './baseScraper.js';
// Requires an approved Apple API integration; supplied URLs are never fetched.
export const appleScraper: Scraper = {
  async check() { throw new NotConfiguredError('apple'); },
};
