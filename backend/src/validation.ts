import { z } from 'zod';
export const credentials = z.object({
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(8).max(128),
}).strict();
export { newItem } from '@inventory-checker/core';
export const updateSettings = z.object({
  notifications_enabled: z.boolean().optional(),
  check_interval_minutes: z.number().int().min(5).max(10080).optional(),
}).strict().refine(v => Object.keys(v).length > 0, 'Provide a setting');
export const readNotification = z.object({ read: z.literal(true) }).strict();
export const deviceToken = z.object({ token: z.string().trim().min(1).max(4096) }).strict();
export const idSchema = z.string().uuid();
