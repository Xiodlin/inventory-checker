import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type pg from 'pg';
import type { Config } from './config/environment.js';
import { authenticate } from './api/middleware/auth.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { usersRoutes } from './api/routes/users.js';
import { itemsRoutes } from './api/routes/items.js';
import { inventoryRoutes } from './api/routes/inventory.js';
import { settingsRoutes } from './api/routes/settings.js';
import { notificationsRoutes } from './api/routes/notifications.js';

export function createApp(pool: pg.Pool, config: Config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: false }));
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.use('/api/users', usersRoutes(pool, config));
  app.use('/api', authenticate(config.JWT_SECRET), rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use('/api/items', itemsRoutes(pool));
  app.use('/api/inventory', inventoryRoutes(pool));
  app.use('/api/settings', settingsRoutes(pool));
  app.use('/api/notifications', notificationsRoutes(pool));
  app.use((_req, res) => { res.status(404).json({ error: 'Route not found' }); });
  app.use(errorHandler);
  return app;
}
