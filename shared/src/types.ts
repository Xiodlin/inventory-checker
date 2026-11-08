export interface PickupStore {
  id: string; name: string; distance_miles: number; available: boolean;
}
export interface Item {
  id: string; user_id: string; retailer: 'amazon' | 'target' | 'bestbuy' | 'apple';
  brand: string | null; model: string | null; sku: string | null; url: string | null;
  target_price: number | null; current_price: number | null; in_stock: boolean | null;
  notify_stock: boolean; notify_price: boolean;
  fulfillment: 'shipping' | 'pickup'; pickup_zip: string | null; pickup_radius_miles: number | null;
  pickup_stores: PickupStore[];
  last_checked_at: string | null; last_check_error: string | null;
}
export type NewItem = Pick<Item, 'retailer' | 'notify_stock' | 'notify_price' | 'fulfillment'> & {
  brand?: string; model?: string; sku?: string; url?: string; target_price?: number;
  pickup_zip?: string; pickup_radius_miles?: number;
};
export interface LocalNotification {
  id: string; title: string; body: string; read: boolean; created_at: string; delivery_error: string | null;
}
export interface PricePoint {
  id: string; price: number | null; in_stock: boolean; pickup_stores: PickupStore[]; checked_at: string;
}
export interface LocalSettings {
  notifications_enabled: boolean; check_interval_minutes: number; background_enabled: boolean;
}
export interface MonitorStatus { last_run_at: string | null; error: string | null }
export interface CheckResult {
  checked: number; succeeded: number; failed: number; remaining: number;
  reason: 'complete' | 'busy' | 'disabled' | 'stopped' | 'interrupted';
}
export function checkResultMessage(result: CheckResult): string {
  if (result.reason === 'busy') return 'Another runtime is checking products. Try again shortly.';
  if (result.reason === 'disabled') return 'Background checks are disabled.';
  if (result.reason === 'stopped') return 'Monitoring has stopped. Reopen the app to check products.';
  if (!result.checked && !result.remaining) return 'No products to check.';
  return `Checked ${result.checked} products: ${result.succeeded} succeeded, ${result.failed} failed.`
    + (result.failed ? ' See each product for its check error.' : '')
    + (result.remaining ? ` ${result.remaining} products were not checked; try again while the device is active.` : '');
}
