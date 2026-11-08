import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type pg from 'pg';
import type { Item } from '../../database/models/TrackedItem.js';
import { newItem, idSchema } from '../../validation.js';
export function itemsRoutes(pool: pg.Pool) {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json((await pool.query<Item>('SELECT * FROM tracked_items WHERE user_id=$1 ORDER BY created_at DESC', [res.locals.userId])).rows);
  });
  router.post('/', async (req, res) => {
    const item = newItem.parse(req.body);
    const created = (await pool.query<Item>(`
      INSERT INTO tracked_items(id,user_id,retailer,brand,model,sku,url,target_price,notify_stock,notify_price,fulfillment,pickup_zip,pickup_radius_miles)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `, [randomUUID(), res.locals.userId, item.retailer, item.brand ?? null, item.model ?? null, item.sku ?? null, item.url ?? null, item.target_price ?? null, item.notify_stock, item.notify_price, item.fulfillment, item.pickup_zip ?? null, item.pickup_radius_miles ?? null])).rows[0];
    res.status(201).json(created);
  });
  router.get('/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const item = (await pool.query<Item>('SELECT * FROM tracked_items WHERE id=$1 AND user_id=$2', [id, res.locals.userId])).rows[0];
    if (!item) { res.status(404).json({ error: 'Item not found' }); return; }
    res.json(item);
  });
  router.delete('/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const result = await pool.query('DELETE FROM tracked_items WHERE id=$1 AND user_id=$2 RETURNING id', [id, res.locals.userId]);
    if (!result.rowCount) { res.status(404).json({ error: 'Item not found' }); return; }
    res.status(204).end();
  });
  router.get('/:id/prices', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const exists = await pool.query('SELECT id FROM tracked_items WHERE id=$1 AND user_id=$2', [id, res.locals.userId]);
    if (!exists.rowCount) { res.status(404).json({ error: 'Item not found' }); return; }
    res.json((await pool.query(`
      SELECT p.* FROM price_history p JOIN tracked_items i ON i.id=p.item_id
      WHERE p.item_id=$1 AND i.user_id=$2 ORDER BY p.checked_at DESC LIMIT 1000
    `, [id, res.locals.userId])).rows);
  });
  return router;
}
