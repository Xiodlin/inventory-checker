import type {
  DesktopApi,
  InventoryNotification,
  Item,
  PricePoint,
  SettingsData,
} from '../src/renderer/types';

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

/**
 * The renderer talks to Electron through `window.inventoryDesktop` (see
 * src/renderer/api.ts) instead of HTTP, so stories stub that bridge rather
 * than mocking network requests.
 */
export function installDesktopApiStub(overrides: Partial<DesktopApi> = {}): DesktopApi {
  const api: DesktopApi = {
    items: async () => sampleItems,
    item: async id => sampleItems.find(item => item.id === id) ?? sampleItems[0],
    prices: async () => samplePrices,
    addItem: async item => ({ ...sampleItems[0], ...item, id: 'item-new' }),
    deleteItem: async () => {},
    notifications: async () => sampleNotifications,
    markRead: async () => {},
    settings: async () => sampleSettings,
    saveSettings: async value => value,
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
    shoppingWatches: async () => [],
    saveShoppingWatch: async () => {},
    removeShoppingWatch: async () => {},
    exportBackup: async () => true,
    importBackup: async () => true,
    onChanged: () => () => {},
    ...overrides,
  };
  window.inventoryDesktop = api;
  return api;
}
