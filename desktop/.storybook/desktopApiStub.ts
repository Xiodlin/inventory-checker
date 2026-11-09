import type {
  DesktopApi,
  InventoryNotification,
  Item,
  PricePoint,
  SettingsData,
  ShoppingWatch,
} from '../src/renderer/types';
import type { NotificationTarget } from '@inventory-checker/core';

export const sampleItems: Item[] = [
  {
    id: 'item-1', user_id: 'local', retailer: 'amazon',
    brand: 'Sony', model: 'WH-1000XM5', sku: 'B09XS7JWHH',
    url: 'https://www.amazon.com/dp/B09XS7JWHH',
    target_price: 299.99, current_price: 328, in_stock: true,
    notify_stock: true, notify_price: true,
    fulfillment: 'shipping', pickup_zip: null, pickup_radius_miles: null, pickup_stores: [],
    last_checked_at: '2026-11-07T15:30:00.000Z', last_check_error: null,
  },
  {
    id: 'item-2', user_id: 'local', retailer: 'bestbuy',
    brand: 'Nintendo', model: 'Switch 2', sku: '6614325', url: null,
    target_price: null, current_price: 449.99, in_stock: false,
    notify_stock: true, notify_price: false,
    fulfillment: 'shipping', pickup_zip: null, pickup_radius_miles: null, pickup_stores: [],
    last_checked_at: '2026-11-07T15:30:00.000Z', last_check_error: null,
  },
  {
    id: 'item-3', user_id: 'local', retailer: 'apple',
    brand: 'Apple', model: 'iPhone 17 Pro', sku: null,
    url: 'https://www.apple.com/shop/buy-iphone/iphone-17-pro',
    target_price: null, current_price: 1099, in_stock: true,
    notify_stock: true, notify_price: false,
    fulfillment: 'pickup', pickup_zip: '94016', pickup_radius_miles: 25,
    pickup_stores: [
      { id: 'store-1', name: 'Apple Union Square', distance_miles: 3.2, available: true },
      { id: 'store-2', name: 'Apple Stonestown', distance_miles: 6.8, available: false },
    ],
    last_checked_at: '2026-11-07T15:30:00.000Z', last_check_error: null,
  },
  {
    id: 'item-4', user_id: 'local', retailer: 'target',
    brand: 'LEGO', model: 'Millennium Falcon 75192', sku: null,
    url: 'https://www.target.com/p/-/A-52975289',
    target_price: 699.99, current_price: null, in_stock: null,
    notify_stock: false, notify_price: true,
    fulfillment: 'shipping', pickup_zip: null, pickup_radius_miles: null, pickup_stores: [],
    last_checked_at: '2026-11-07T15:30:00.000Z',
    last_check_error: 'Request was blocked by the retailer',
  },
];

export const samplePrices: PricePoint[] = [
  { id: 'price-1', price: 348, in_stock: true, pickup_stores: [], checked_at: '2026-11-07T15:30:00.000Z' },
  { id: 'price-2', price: 379.99, in_stock: true, pickup_stores: [], checked_at: '2026-11-06T15:30:00.000Z' },
  { id: 'price-3', price: null, in_stock: false, pickup_stores: [], checked_at: '2026-11-05T15:30:00.000Z' },
];

export const sampleNotifications: InventoryNotification[] = [
  {
    id: 'alert-1', title: 'WH-1000XM5 is back in stock',
    body: 'Amazon now lists Sony WH-1000XM5 as in stock at $328.00.',
    read: false, created_at: '2026-11-07T15:31:00.000Z', delivery_error: null,
    target: { kind: 'item', id: 'item-1' },
  },
  {
    id: 'alert-2', title: 'iPhone 17 Pro pickup available',
    body: 'Apple Union Square (3.2 mi) has pickup availability near 94016.',
    read: false, created_at: '2026-11-07T12:00:00.000Z',
    delivery_error: 'Notifications are disabled at the OS level',
  },
  {
    id: 'alert-3', title: 'Switch 2 dropped to $449.99',
    body: 'Best Buy lowered the price below your previous check.',
    read: true, created_at: '2026-11-06T09:15:00.000Z', delivery_error: null,
  },
];

export const sampleSettings: SettingsData = {
  notifications_enabled: true,
  check_interval_minutes: 30,
  background_enabled: true,
};

export const sampleWatches: ShoppingWatch[] = [
  {
    id: 'watch-1', input: { product: 'MacBook Neo', variants: ['256GB', 'Indigo'] }, enabled: true,
    last_checked_at: '2026-11-08T15:30:00.000Z', error: null,
    result: { id: 'search-1', input: { product: 'MacBook Neo', variants: ['256GB', 'Indigo'] },
      checked_at: '2026-11-08T15:30:00.000Z', error: null,
      offers: [
        { title: 'MacBook Neo 256GB Indigo', seller: 'eBay', price: '$2,099.00', url: 'https://www.ebay.com/itm/1',
          match: 'text-match', missing: [], availability: 'unknown', availability_text: 'No unambiguous stock label' },
        { title: 'MacBook Neo 256GB Indigo', seller: 'Apple', price: '$1,999.00', url: 'https://www.apple.com/shop/product/abc12/a',
          match: 'text-match', missing: [], availability: 'reported-in-stock', availability_text: 'Pickup today',
          sale_text: '20% off', details: ['Pickup today', 'Free returns'],
          verification: { status: 'verified', message: 'Matching product observed on retailer page', in_stock: true, price: 1999 } },
        { title: 'MacBook Neo 256GB Indigo', seller: 'Apple Education Store', price: '$1,999.00', url: 'https://www.google.com/aclk?adurl=',
          match: 'text-match', missing: [], availability: 'reported-in-stock', availability_text: 'Pickup tomorrow',
          verification: { status: 'unsupported', message: 'Opaque Google advertising destination cannot be verified' } },
        { title: 'MacBook Neo 256GB Indigo', seller: 'eBay', price: '$2,599.00', url: 'https://www.ebay.com/itm/2',
          match: 'text-match', missing: [], availability: 'reported-out-of-stock', availability_text: 'Out of stock' },
        { title: 'MacBook Neo 256GB Indigo', seller: 'eBay', price: '$2,989.00', url: 'https://www.ebay.com/itm/3',
          match: 'text-match', missing: [], availability: 'unknown', availability_text: 'No unambiguous stock label' },
        { title: 'MacBook Neo 256GB Indigo', seller: 'Unassessed shop', price: '$2,199.00', url: 'https://unassessed.example/product',
          match: 'text-match', missing: [], availability: 'unknown', availability_text: 'No unambiguous stock label',
          verification: { status: 'failed', message: 'Retailer did not publish usable product metadata' } },
        { title: 'Case for MacBook Neo 256GB Indigo', seller: 'Target', price: '$29.00', url: 'https://www.target.com/p/case/-/A-12345',
          match: 'uncertain', missing: ['Product, not an accessory'], availability: 'reported-in-stock', availability_text: 'In stock' },
      ] },
  },
];

/**
 * The renderer talks to Electron through `window.inventoryDesktop` (see
 * src/renderer/api.ts) instead of HTTP, so stories stub that bridge rather
 * than mocking network requests.
 */
export function installDesktopApiStub(overrides: Partial<DesktopApi> = {}, initial: {
  items?: Item[]; notifications?: InventoryNotification[]; watches?: ShoppingWatch[]; settings?: SettingsData;
} = {}): DesktopApi {
  let items = structuredClone(initial.items ?? sampleItems);
  let notifications = structuredClone(initial.notifications ?? sampleNotifications);
  let watches = structuredClone(initial.watches ?? sampleWatches);
  let settings = { ...(initial.settings ?? sampleSettings) };
  const listeners = new Set<() => void>();
  const openListeners = new Set<(target: NotificationTarget | null) => void>();
  const changed = () => listeners.forEach(listener => listener());
  const api: DesktopApi = {
    items: async () => structuredClone(items),
    item: async id => {
      const item = items.find(item => item.id === id);
      if (!item) throw new Error('Product not found');
      return structuredClone(item);
    },
    prices: async () => samplePrices,
    addItem: async item => ({ ...sampleItems[0], ...item, id: 'item-new' }),
    deleteItem: async id => { items = items.filter(item => item.id !== id); changed(); },
    notifications: async () => structuredClone(notifications),
    clearNotifications: async () => { notifications = []; changed(); },
    deleteNotification: async id => { notifications = notifications.filter(alert => alert.id !== id); changed(); },
    onNotificationOpen: callback => { openListeners.add(callback); return () => { openListeners.delete(callback); }; },
    markRead: async id => {
      notifications = notifications.map(alert => alert.id === id ? { ...alert, read: true } : alert); changed();
    },
    settings: async () => ({ ...settings }),
    saveSettings: async value => { settings = { ...value }; changed(); return { ...settings }; },
    status: async () => ({ last_run_at: '2026-11-07T15:30:00.000Z', error: null }),
    check: async () => ({ checked: 4, succeeded: 3, failed: 1, remaining: 0, reason: 'complete' }),
    checkDue: async () => ({ checked: 4, succeeded: 3, failed: 1, remaining: 0, reason: 'complete' }),
    saveKey: async () => {},
    hasKey: async () => false,
    testNotification: async () => {},
    shoppingSearch: async input => ({ id: 'search-fixture', input, checked_at: new Date().toISOString(), offers: [],
      error: 'Storybook does not perform live Google searches.' }),
    shoppingHistory: async () => [],
    clearShoppingHistory: async () => {},
    shoppingWatches: async () => structuredClone(watches),
    saveShoppingWatch: async input => {
      watches = [...watches, { id: `watch-${watches.length + 1}`, input, enabled: true,
        last_checked_at: null, error: null, result: null }]; changed();
    },
    removeShoppingWatch: async id => { watches = watches.filter(watch => watch.id !== id); changed(); },
    exportBackup: async () => true,
    importBackup: async () => true,
    onChanged: callback => { listeners.add(callback); return () => { listeners.delete(callback); }; },
    ...overrides,
  };
  window.inventoryDesktop = api;
  return api;
}
