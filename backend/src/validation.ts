import { z } from 'zod';
export const credentials = z.object({
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(8).max(128),
}).strict();
export const newItem = z.object({
  retailer: z.enum(['amazon', 'target', 'bestbuy', 'apple']),
  brand: z.string().trim().min(1).max(120).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().min(1).max(120).optional(),
  url: z.string().url().max(2048).refine(v => ['https:', 'http:'].includes(new URL(v).protocol)).optional(),
  target_price: z.number().finite().nonnegative().max(9999999999.99).optional(),
}).strict().refine(v => Boolean(v.sku || v.url || v.model), 'Provide a SKU, URL, or model');
export const updateSettings = z.object({
  notifications_enabled: z.boolean().optional(),
  check_interval_minutes: z.number().int().min(5).max(10080).optional(),
}).strict().refine(v => Object.keys(v).length > 0, 'Provide a setting');
export const readNotification = z.object({ read: z.literal(true) }).strict();
export const deviceToken = z.object({ token: z.string().trim().min(1).max(4096) }).strict();
export const idSchema = z.string().uuid();
