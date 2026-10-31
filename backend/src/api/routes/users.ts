import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type pg from 'pg';
import type { Config } from '../../config/environment.js';
import type { User } from '../../database/models/User.js';
import { authenticate, hashPassword, issueToken, verifyPassword } from '../middleware/auth.js';
import { credentials } from '../../validation.js';

export function usersRoutes(pool: pg.Pool, config: Config) {
  const router = Router();
  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
  // Equalize missing-account verification with the same scrypt cost.
  const dummyHash = hashPassword(randomUUID());
  router.post('/register', authLimit, async (req, res) => {
    const input = credentials.parse(req.body);
    const passwordHash = await hashPassword(input.password);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = (await client.query<User>(
        'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3) RETURNING id,email,created_at',
        [randomUUID(), input.email, passwordHash],
      )).rows[0];
      await client.query('INSERT INTO settings(user_id) VALUES($1)', [user.id]);
      await client.query('COMMIT');
      res.status(201).json({ token: issueToken(user.id, config.JWT_SECRET), user });
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') { res.status(409).json({ error: 'Email is already registered' }); return; }
      throw error;
    } finally { client.release(); }
  });
  router.post('/login', authLimit, async (req, res) => {
    const input = credentials.parse(req.body);
    const account = (await pool.query<User & { password_hash: string }>('SELECT id,email,password_hash,created_at FROM users WHERE email=$1', [input.email])).rows[0];
    const valid = await verifyPassword(input.password, account?.password_hash ?? await dummyHash);
    if (!account || !valid) { res.status(401).json({ error: 'Invalid email or password' }); return; }
    const { password_hash: _, ...user } = account;
    res.json({ token: issueToken(user.id, config.JWT_SECRET), user });
  });
  router.get('/me', authenticate(config.JWT_SECRET), async (_req, res) => {
    const user = (await pool.query<User>('SELECT id,email,created_at FROM users WHERE id=$1', [res.locals.userId])).rows[0];
    if (!user) { res.status(401).json({ error: 'Account not found' }); return; }
    res.json(user);
  });
  return router;
}
