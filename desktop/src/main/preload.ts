import { contextBridge, ipcRenderer } from 'electron';
import type { Item, NewItem, LocalNotification, LocalSettings, PricePoint, MonitorStatus, CheckResult, NotificationTarget } from '@inventory-checker/core';
import type { ShoppingInput, ShoppingSearch } from './shoppingTypes';
import type { ShoppingWatch } from '@inventory-checker/core';

contextBridge.exposeInMainWorld('inventoryDesktop', Object.freeze({
  items: (): Promise<Item[]> => ipcRenderer.invoke('inventory:local', 'items'),
  item: (id: string): Promise<Item> => ipcRenderer.invoke('inventory:local', 'item', id),
  prices: (id: string): Promise<PricePoint[]> => ipcRenderer.invoke('inventory:local', 'prices', id),
  addItem: (item: NewItem): Promise<Item> => ipcRenderer.invoke('inventory:local', 'add', item),
  deleteItem: (id: string): Promise<void> => ipcRenderer.invoke('inventory:local', 'delete', id),
  notifications: (): Promise<LocalNotification[]> => ipcRenderer.invoke('inventory:local', 'notifications'),
  clearNotifications: (): Promise<void> => ipcRenderer.invoke('inventory:local', 'clear-notifications'),
  deleteNotification: (id: string): Promise<void> => ipcRenderer.invoke('inventory:local', 'delete-notification', id),
  onNotificationOpen: (callback: (target: NotificationTarget | null) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, target: NotificationTarget | null) => callback(target);
    ipcRenderer.on('inventory:notification-open', listener);
    return () => ipcRenderer.removeListener('inventory:notification-open', listener);
  },
  markRead: (id: string): Promise<void> => ipcRenderer.invoke('inventory:local', 'read', id),
  settings: (): Promise<LocalSettings> => ipcRenderer.invoke('inventory:local', 'settings'),
  saveSettings: (value: LocalSettings): Promise<LocalSettings> => ipcRenderer.invoke('inventory:local', 'save-settings', value),
  status: (): Promise<MonitorStatus> => ipcRenderer.invoke('inventory:local', 'status'),
  check: (): Promise<CheckResult> => ipcRenderer.invoke('inventory:local', 'check'),
  checkDue: (): Promise<CheckResult> => ipcRenderer.invoke('inventory:local', 'check-due'),
  saveKey: (key: string): Promise<void> => ipcRenderer.invoke('inventory:local', 'save-key', key),
  hasKey: (): Promise<boolean> => ipcRenderer.invoke('inventory:local', 'has-key'),
  testNotification: (): Promise<void> => ipcRenderer.invoke('inventory:local', 'test-notification'),
  shoppingSearch: (input: ShoppingInput): Promise<ShoppingSearch> => ipcRenderer.invoke('inventory:local', 'shopping-search', input),
  shoppingHistory: (): Promise<ShoppingSearch[]> => ipcRenderer.invoke('inventory:local', 'shopping-history'),
  clearShoppingHistory: (): Promise<void> => ipcRenderer.invoke('inventory:local', 'shopping-clear'),
  shoppingWatches: (): Promise<ShoppingWatch[]> => ipcRenderer.invoke('inventory:local', 'shopping-watches'),
  saveShoppingWatch: (input: ShoppingInput): Promise<void> => ipcRenderer.invoke('inventory:local', 'shopping-save-watch', input),
  removeShoppingWatch: (id: string): Promise<void> => ipcRenderer.invoke('inventory:local', 'shopping-remove-watch', id),
  exportBackup: (): Promise<boolean> => ipcRenderer.invoke('inventory:local', 'export'),
  importBackup: (): Promise<boolean> => ipcRenderer.invoke('inventory:local', 'import'),
  onChanged: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('inventory:changed', listener);
    return () => ipcRenderer.removeListener('inventory:changed', listener);
  },
}));
