import type { Item, PickupStore } from '../types';
export class NotConfiguredError extends Error {
  constructor(retailer: string) { super(`${retailer} integration is not configured`); this.name = 'NotConfiguredError'; }
}
export interface InventoryResult { price: number | null; in_stock: boolean; pickup_stores?: PickupStore[] }
export interface Scraper {
  check(item: Item): Promise<InventoryResult>;
}
