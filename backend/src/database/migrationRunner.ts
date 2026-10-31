import { readFile } from 'node:fs/promises';
import type pg from 'pg';
const migrations = [{ version: 1, file: new URL('./migrations/001_initial_schema.sql', import.meta.url) }];
export async function migrate(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [814726391]);
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = await client.query<{ version: number }>('SELECT version FROM schema_migrations');
    for (const migration of migrations) {
      if (applied.rows.some(row => row.version === migration.version)) continue;
      await client.query(await readFile(migration.file, 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [migration.version]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
