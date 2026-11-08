import { z } from 'zod';

export const newItem = z.object({
  retailer: z.enum(['amazon', 'target', 'bestbuy', 'apple']),
  brand: z.string().trim().min(1).max(120).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().min(1).max(120).optional(),
  url: z.string().url().max(2048).refine(v => ['https:', 'http:'].includes(new URL(v).protocol)).optional(),
  target_price: z.number().finite().nonnegative().max(9999999999.99).optional(),
  notify_stock: z.boolean().default(true),
  notify_price: z.boolean().optional(),
  fulfillment: z.enum(['shipping', 'pickup']).default('shipping'),
  pickup_zip: z.string().regex(/^\d{5}$/, 'Use a five-digit US ZIP code').optional(),
  pickup_radius_miles: z.number().int().min(1).max(250).optional(),
}).strict().refine(v => Boolean(v.sku || v.url || v.model), 'Provide a SKU, URL, or model')
  .refine(v => v.fulfillment !== 'pickup' || (v.retailer === 'apple' && v.url && v.pickup_zip),
    'Apple pickup requires a product URL and a five-digit ZIP code')
  .refine(v => v.fulfillment === 'pickup' || (v.pickup_zip === undefined && v.pickup_radius_miles === undefined),
    'Pickup location fields require pickup tracking')
  .transform(v => ({
    ...v, notify_price: v.notify_price ?? v.target_price !== undefined,
    ...(v.fulfillment === 'pickup' ? { pickup_radius_miles: v.pickup_radius_miles ?? 50 } : {}),
  }))
  .refine(v => v.notify_stock || v.notify_price, 'Select stock alerts, price alerts, or both')
  .refine(v => !v.notify_price || v.target_price !== undefined, 'Price alerts require a target price');

export const localSettings = z.object({
  notifications_enabled: z.boolean(),
  check_interval_minutes: z.number().int().min(5).max(10080),
  background_enabled: z.boolean(),
}).strict();
export const identifier = z.string().uuid();
