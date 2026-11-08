import type { Item, NewItem, LocalSettings } from '@inventory-checker/core';
import { localRuntime } from './localRuntime';
import { AppState } from 'react-native';
import { shoppingBrowser } from './shoppingBrowser';

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
  check: async () => {
    const runtime = await localRuntime();
    if (shoppingBrowser.busy()) throw new Error('Wait for the active Google search before checking the watchlist.');
    await runtime.shopping.checkNow();
    if (AppState.currentState !== 'active') throw new Error('Watchlist check interrupted because the app left the foreground.');
    return runtime.monitor.checkNow();
  },
  checkDue: async () => (await localRuntime()).monitor.tick(),
  status: async () => (await localRuntime()).store.status(),
};
