import pg from 'pg';
import type { Config } from '../config/environment.js';
// Money columns are numeric(12,2), safely within JavaScript's integer precision.
pg.types.setTypeParser(1700, Number);
export function createPool(config: Config) {
  return new pg.Pool({ connectionString: config.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
}
