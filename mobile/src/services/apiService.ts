import type { Item, NewItem, LocalSettings } from '@inventory-checker/core';
import { localRuntime } from './localRuntime';

export type { Item, NewItem };
export type Retailer = Item['retailer'];
export type { LocalNotification as Notification, LocalSettings as Settings, PricePoint as Price } from '@inventory-checker/core';

// Kept as the screen-facing facade; every operation is now device-local SQLite.
export const apiService = {
  items: async () => (await localRuntime()).store.items(),
  item: async (id: string) => (await localRuntime()).store.item(id),
  prices: async (id: string) => (await localRuntime()).store.prices(id),
  addItem: async (item: NewItem) => (await localRuntime()).store.addItem(item),
  deleteItem: async (id: string) => (await localRuntime()).store.deleteItem(id),
  settings: async () => (await localRuntime()).store.settings(),
  saveSettings: async (value: LocalSettings) => (await localRuntime()).store.saveSettings(value),
  notifications: async () => (await localRuntime()).store.notifications(),
  markRead: async (id: string) => (await localRuntime()).store.markRead(id),
  check: async () => (await localRuntime()).monitor.checkNow(),
  checkDue: async () => (await localRuntime()).monitor.tick(),
  status: async () => (await localRuntime()).store.status(),
};
