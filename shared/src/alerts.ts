import type { Item } from './types';
import type { InventoryResult } from './scrapers/baseScraper';

export function notificationReason(item: Item, result: InventoryResult): string | null {
  const pickup = item.fulfillment === 'pickup';
  const newlyAvailable = (result.pickup_stores ?? []).filter(store => store.available
    && !item.pickup_stores?.some(previous => previous.id === store.id && previous.available));
  const backInStock = result.in_stock && (pickup ? newlyAvailable.length > 0 : item.in_stock !== true);
  const hitsTarget = item.notify_price && result.in_stock && result.price !== null && item.target_price !== null && result.price <= item.target_price
    && (item.current_price === null || item.current_price > item.target_price || result.price < item.current_price || backInStock);
  const reasons: string[] = [];
  const alertStores = pickup ? (item.notify_stock && backInStock ? newlyAvailable : (result.pickup_stores ?? []).filter(store => store.available)) : [];
  const summary = alertStores.slice(0, 5).map(store => `${store.name} (${store.distance_miles.toFixed(1)} mi)`).join(', ')
    + (alertStores.length > 5 ? ` and ${alertStores.length - 5} more stores` : '');
  if (item.notify_stock && backInStock) {
    if (pickup) reasons.push(`Available for pickup at ${summary}.`);
    else reasons.push(item.in_stock === false ? 'Your tracked item is back in stock.' : 'Your tracked item is in stock.');
  }
  if (hitsTarget) {
    if (pickup && reasons.length === 0) reasons.push(`Available for pickup at ${summary}.`);
    reasons.push(`Price is ${result.price!.toFixed(2)}, at or below your target of ${item.target_price!.toFixed(2)}.`);
  }
  return reasons.length ? reasons.join(' ') : null;
}
