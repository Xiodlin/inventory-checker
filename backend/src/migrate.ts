import { parseConfig } from './config/environment.js';
import { createPool } from './database/connection.js';
import { migrate } from './database/migrationRunner.js';
const pool = createPool(parseConfig(process.env));
try {
  await migrate(pool);
  console.log('Migrations applied');
} finally {
  await pool.end();
}
