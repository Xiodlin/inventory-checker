import { Router } from 'express';
import type pg from 'pg';
import { updateSettings } from '../../validation.js';
export function settingsRoutes(pool: pg.Pool) {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json((await pool.query('SELECT notifications_enabled,check_interval_minutes FROM settings WHERE user_id=$1', [res.locals.userId])).rows[0]);
  });
  router.patch('/', async (req, res) => {
    const input = updateSettings.parse(req.body);
    res.json((await pool.query(`
      UPDATE settings SET notifications_enabled=COALESCE($1,notifications_enabled),
      check_interval_minutes=COALESCE($2,check_interval_minutes) WHERE user_id=$3
      RETURNING notifications_enabled,check_interval_minutes
    `, [input.notifications_enabled ?? null, input.check_interval_minutes ?? null, res.locals.userId])).rows[0]);
  });
  return router;
}
