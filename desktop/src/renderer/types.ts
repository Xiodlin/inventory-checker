import type { Item, NewItem, LocalNotification, LocalSettings, PricePoint, MonitorStatus, CheckResult, ShoppingWatch } from '@inventory-checker/core';
import type { ShoppingInput, ShoppingSearch } from '../main/shoppingTypes';
import type { NotificationTarget } from '@inventory-checker/core';
export type { ShoppingInput, ShoppingSearch, ShoppingOffer } from '../main/shoppingTypes';
export type { ShoppingWatch } from '@inventory-checker/core';
export type { Item, NewItem, PricePoint };
export type InventoryNotification = LocalNotification;
export type SettingsData = LocalSettings;

export interface DesktopApi {
  items(): Promise<Item[]>;
  item(id: string): Promise<Item>;
  prices(id: string): Promise<PricePoint[]>;
  addItem(item: NewItem): Promise<Item>;
  deleteItem(id: string): Promise<void>;
  notifications(): Promise<LocalNotification[]>;
  clearNotifications(): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  onNotificationOpen(callback: (target: NotificationTarget | null) => void): () => void;
  markRead(id: string): Promise<void>;
  settings(): Promise<LocalSettings>;
  saveSettings(value: LocalSettings): Promise<LocalSettings>;
  status(): Promise<MonitorStatus>;
  check(): Promise<CheckResult>;
  checkDue(): Promise<CheckResult>;
  saveKey(value: string): Promise<void>;
  hasKey(): Promise<boolean>;
  testNotification(): Promise<void>;
  shoppingSearch(input: ShoppingInput): Promise<ShoppingSearch>;
  shoppingHistory(): Promise<ShoppingSearch[]>;
  clearShoppingHistory(): Promise<void>;
  shoppingWatches(): Promise<ShoppingWatch[]>;
  saveShoppingWatch(input: ShoppingInput): Promise<void>;
  removeShoppingWatch(id: string): Promise<void>;
  exportBackup(): Promise<boolean>;
  importBackup(): Promise<boolean>;
  onChanged(callback: () => void): () => void;
}
declare global {
  interface Window { inventoryDesktop?: DesktopApi }
}
