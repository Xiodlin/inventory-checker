import { Router } from 'express';
import type pg from 'pg';
import type { Item } from '../../database/models/TrackedItem.js';
export function inventoryRoutes(pool: pg.Pool) {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json((await pool.query<Item>('SELECT * FROM tracked_items WHERE user_id=$1 ORDER BY created_at DESC', [res.locals.userId])).rows);
  });
  return router;
}
