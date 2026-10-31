import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { createApp } from '../src/app.js';
import { issueToken } from '../src/api/middleware/auth.js';
import { parseConfig } from '../src/config/environment.js';

test('health, authentication, validation, and ownership are enforced', async () => {
  const queries: { sql: string; params: unknown[] }[] = [];
  const pool = { query: async (sql: string, params: unknown[]) => { queries.push({ sql, params }); return { rows: [], rowCount: 0 }; } } as unknown as pg.Pool;
  const config = parseConfig({ DATABASE_URL: 'postgresql://localhost/db', REDIS_URL: 'redis://localhost', JWT_SECRET: 'a'.repeat(64) });
  config.CORS_ORIGIN = ['http://localhost:5173', 'null', 'file://'];
  const server = createServer(createApp(pool, config));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const userId = randomUUID();
  const headers = { authorization: ['Bearer', issueToken(userId, config.JWT_SECRET)].join(' '), 'content-type': 'application/json' };
  try {
    assert.deepEqual(await (await fetch(`${base}/health`)).json(), { status: 'ok' });
    const packagedCors = await fetch(`${base}/health`, { headers: { origin: 'null' } });
    assert.equal(packagedCors.headers.get('access-control-allow-origin'), 'null');
    assert.equal(packagedCors.headers.get('access-control-allow-credentials'), null);
    const fileCors = await fetch(`${base}/health`, { headers: { origin: 'file://' } });
    assert.equal(fileCors.headers.get('access-control-allow-origin'), 'file://');
    const foreignCors = await fetch(`${base}/health`, { headers: { origin: 'https://evil.example' } });
    assert.equal(foreignCors.headers.get('access-control-allow-origin'), null);
    assert.equal((await fetch(`${base}/api/items`)).status, 401);
    assert.equal((await fetch(`${base}/api/items`, { headers: { authorization: ['Bearer', 'invalid'].join(' ') } })).status, 401);
    assert.equal(queries.length, 0);
    assert.equal((await fetch(`${base}/api/users/register`, { method: 'POST', headers, body: JSON.stringify({ email: 'bad', password: 'x' }) })).status, 400);
    assert.equal((await fetch(`${base}/api/settings`, { method: 'PATCH', headers, body: JSON.stringify({ check_interval_minutes: 1 }) })).status, 400);
    assert.equal((await fetch(`${base}/api/items/not-a-uuid`, { headers })).status, 400);
    const foreignItem = randomUUID();
    assert.equal((await fetch(`${base}/api/items/${foreignItem}`, { headers })).status, 404);
    assert.match(queries[0].sql, /user_id=\$2/);
    assert.deepEqual(queries[0].params, [foreignItem, userId]);
    assert.equal((await fetch(`${base}/api/items/${foreignItem}`, { method: 'DELETE', headers })).status, 404);
    assert.equal((await fetch(`${base}/api/items/${foreignItem}/prices`, { headers })).status, 404);
    assert.equal((await fetch(`${base}/api/notifications/${randomUUID()}`, { method: 'PATCH', headers, body: '{"read":true}' })).status, 404);
    assert.ok(queries.every(q => q.params.includes(userId)));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
