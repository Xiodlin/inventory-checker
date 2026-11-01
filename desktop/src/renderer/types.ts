export interface User { id: number | string; email: string }
export interface Item {
  id: number | string;
  retailer: 'amazon' | 'target' | 'bestbuy' | 'apple';
  brand?: string | null; model?: string | null; sku?: string | null; url?: string | null;
  current_price?: number | null; in_stock?: boolean | number | null; target_price?: number | null;
}
export type NewItem = Omit<Item, 'id' | 'current_price' | 'in_stock'>;
export interface InventoryNotification {
  id: number | string; title: string; body: string;
  read: boolean | number; created_at: string;
}
export interface SettingsData { notifications_enabled: boolean; check_interval_minutes: number }
export interface PricePoint { price: number; recorded_at?: string; checked_at?: string; created_at?: string }

declare global {
  interface Window {
    inventoryDesktop?: { notify(title: string, body: string): Promise<boolean> };
  }
}
