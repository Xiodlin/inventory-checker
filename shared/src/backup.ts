import { z } from 'zod';
import { identifier, newItem } from './validation';
import type { Item } from './types';

export const pickupStoreSchema = z.object({
  id: z.string().min(1).max(40), name: z.string().min(1).max(120),
  distance_miles: z.number().finite().nonnegative(), available: z.boolean(),
});
export const backupSchema = z.object({
  version: z.literal(1),
  items: z.array(z.object({
    id: identifier, product: newItem,
    current_price: z.number().finite().nonnegative().max(9999999999.99).nullable(),
    in_stock: z.boolean().nullable(), pickup_stores: z.array(pickupStoreSchema).max(500),
    last_checked_at: z.string().datetime().nullable(), last_check_error: z.string().max(300).nullable(),
    history: z.array(z.object({
      id: identifier, price: z.number().finite().nonnegative().max(9999999999.99).nullable(),
      in_stock: z.boolean(), pickup_stores: z.array(pickupStoreSchema).max(500), checked_at: z.string().datetime(),
    })).max(1000),
  })).max(500),
  notifications: z.array(z.object({
    id: identifier, title: z.string().min(1).max(120), body: z.string().max(1000),
    read: z.boolean(), created_at: z.string().datetime(),
  })).max(1000),
}).strict();

function checkBackupSize(text: string) {
  if (text.length > 16 * 1024 * 1024 || new TextEncoder().encode(text).byteLength > 16 * 1024 * 1024) {
    throw new Error('Backup exceeds the 16 MB limit');
  }
}
export function parseBackup(text: string) {
  checkBackupSize(text);
  return backupSchema.parse(JSON.parse(text));
}
export function serializeBackup(value: unknown) {
  const text = JSON.stringify(backupSchema.parse(value), null, 2);
  checkBackupSize(text);
  return text;
}

export function itemInput(item: Item) {
  return {
    retailer: item.retailer, notify_stock: item.notify_stock, notify_price: item.notify_price, fulfillment: item.fulfillment,
    ...(item.brand ? { brand: item.brand } : {}), ...(item.model ? { model: item.model } : {}),
    ...(item.sku ? { sku: item.sku } : {}), ...(item.url ? { url: item.url } : {}),
    ...(item.target_price !== null ? { target_price: item.target_price } : {}),
    ...(item.fulfillment === 'pickup' ? { pickup_zip: item.pickup_zip!, pickup_radius_miles: item.pickup_radius_miles! } : {}),
  };
}
