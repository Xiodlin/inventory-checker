import type { Item } from '../database/models/TrackedItem.js';
export class NotConfiguredError extends Error {
  constructor(retailer: string) { super(`${retailer} integration is not configured`); this.name = 'NotConfiguredError'; }
}
export interface InventoryResult { price: number; in_stock: boolean }
export interface Scraper {
  check(item: Item): Promise<InventoryResult>;
}
