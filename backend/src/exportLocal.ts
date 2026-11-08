import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PoolClient } from 'pg';
import { serializeBackup, itemInput, type Item } from '@inventory-checker/core';
import { parseConfig } from './config/environment.js';
import { createPool } from './database/connection.js';

export async function exportLegacyBackup(client: Pick<PoolClient, 'query'>, email: string) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const owner = (await client.query<{ id: string }>('SELECT id FROM users WHERE email=$1', [email.trim().toLowerCase()])).rows[0];
    if (!owner) throw new Error('Account not found in the legacy local database');
    const entries = [];
    for (const item of (await client.query<Item>('SELECT * FROM tracked_items WHERE user_id=$1 ORDER BY created_at', [owner.id])).rows) {
      const history = (await client.query('SELECT id,price,in_stock,pickup_stores,checked_at FROM price_history WHERE item_id=$1 ORDER BY checked_at DESC LIMIT 1000', [item.id])).rows
        .map(point => ({ ...point, checked_at: new Date(point.checked_at).toISOString() }));
      entries.push({
        id: item.id, product: itemInput(item), current_price: item.current_price, in_stock: item.in_stock,
        pickup_stores: item.pickup_stores, last_checked_at: item.last_checked_at ? new Date(item.last_checked_at).toISOString() : null,
        last_check_error: item.last_check_error, history,
      });
    }
    const notifications = (await client.query('SELECT id,title,body,read,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1000', [owner.id])).rows
      .map(alert => ({ ...alert, created_at: new Date(alert.created_at).toISOString() }));
    const backup = serializeBackup({ version: 1, items: entries, notifications });
    await client.query('COMMIT');
    return { backup, count: entries.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [email, output] = process.argv.slice(2);
  if (!email || !output) throw new Error('Usage: npm run export:local --workspace backend -- <account-email> <output.json>');
  const pool = createPool(parseConfig(process.env));
  try {
    const client = await pool.connect();
    let exported;
    try { exported = await exportLegacyBackup(client, email); }
    finally { client.release(); }
    await writeFile(output, exported.backup, { mode: 0o600, flag: 'wx' });
    console.log(`Exported ${exported.count} tracked products. Import the JSON in the app's Settings. No credentials were exported.`);
  } finally { await pool.end(); }
}
