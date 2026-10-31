import { createServer } from 'node:http';
import { parseConfig } from './config/environment.js';
import { createPool } from './database/connection.js';
import { createApp } from './app.js';
import { JsonCache } from './services/cacheService.js';
import { Realtime } from './services/websocketService.js';
import { PushService } from './services/notificationService.js';
import { Scheduler } from './services/schedulerService.js';

const config = parseConfig(process.env);
const pool = createPool(config);
pool.on('error', () => console.warn('PostgreSQL connection error'));
const cache = new JsonCache(config.REDIS_URL);
try {
  await pool.query('SELECT 1');
  await cache.connect();
  const server = createServer(createApp(pool, config));
  const realtime = new Realtime(server, config.JWT_SECRET, config.CORS_ORIGIN);
  const push = new PushService(pool, config);
  const scheduler = new Scheduler(pool, cache, realtime, push, config);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.PORT, () => { server.off('error', reject); resolve(); });
  });
  scheduler.start();
  console.log(`Inventory API listening on port ${config.PORT}`);
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => process.exit(1), 30000).unref();
    const httpClosed = new Promise<void>(resolve => server.close(() => resolve()));
    await scheduler.stop();
    await realtime.close();
    await httpClosed;
    await cache.close();
    await pool.end();
    clearTimeout(deadline);
  };
  process.once('SIGINT', () => { void shutdown().catch(() => process.exit(1)); });
  process.once('SIGTERM', () => { void shutdown().catch(() => process.exit(1)); });
} catch (error) {
  console.error('Backend startup failed:', error instanceof Error ? error.message : 'Unknown error');
  await cache.close();
  await pool.end();
  process.exitCode = 1;
}
