import test from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { migrate } from '../src/database/migrationRunner.js';

test('migration reads SQL asset under transactional advisory lock and tracks its version', async () => {
  const queries: string[] = [];
  let released = false;
  const client = {
    query: async (sql: string) => { queries.push(sql); return { rows: [] }; },
    release: () => { released = true; },
  };
  await migrate({ connect: async () => client } as unknown as pg.Pool);
  assert.equal(queries[0], 'BEGIN');
  assert.match(queries[1], /pg_advisory_xact_lock/);
  assert.ok(queries.some(sql => sql.includes('CREATE TABLE tracked_items')));
  assert.ok(queries.some(sql => sql.includes('INSERT INTO schema_migrations')));
  assert.equal(queries.at(-1), 'COMMIT');
  assert.equal(released, true);
});
test('migration failures rollback and release the connection', async () => {
  const queries: string[] = [];
  let released = false;
  const client = {
    query: async (sql: string) => {
      queries.push(sql);
      if (sql.includes('CREATE TABLE users')) throw new Error('SQL failure');
      return { rows: [] };
    },
    release: () => { released = true; },
  };
  await assert.rejects(migrate({ connect: async () => client } as unknown as pg.Pool), /SQL failure/);
  assert.equal(queries.at(-1), 'ROLLBACK');
  assert.equal(released, true);
});
