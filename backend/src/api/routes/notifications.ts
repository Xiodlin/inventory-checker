import { Router } from 'express';
import type pg from 'pg';
import { idSchema, readNotification, deviceToken } from '../../validation.js';
export function notificationsRoutes(pool: pg.Pool) {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json((await pool.query('SELECT id,title,body,read,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200', [res.locals.userId])).rows);
  });
  router.post('/devices', async (req, res) => {
    const { token } = deviceToken.parse(req.body);
    const result = await pool.query(`
      INSERT INTO device_tokens(token,user_id) VALUES($1,$2)
      ON CONFLICT(token) DO UPDATE SET created_at=now() WHERE device_tokens.user_id=EXCLUDED.user_id RETURNING token
    `, [token, res.locals.userId]);
    if (!result.rowCount) { res.status(409).json({ error: 'Device is registered to another account' }); return; }
    res.status(201).json({ registered: true });
  });
  router.delete('/devices', async (req, res) => {
    const { token } = deviceToken.parse(req.body);
    await pool.query('DELETE FROM device_tokens WHERE token=$1 AND user_id=$2', [token, res.locals.userId]);
    res.status(204).end();
  });
  router.patch('/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    readNotification.parse(req.body);
    const result = await pool.query('UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2 RETURNING id,title,body,read,created_at', [id, res.locals.userId]);
    if (!result.rowCount) { res.status(404).json({ error: 'Notification not found' }); return; }
    res.json(result.rows[0]);
  });
  return router;
}
