import { z } from 'zod';
import { notificationReason } from './alerts';
import { itemInput, parseBackup, pickupStoreSchema, serializeBackup } from './backup';
import { identifier, localSettings, newItem } from './validation';
import type { InventoryResult } from './scrapers/baseScraper';
import type { Item, LocalNotification, LocalSettings, MonitorStatus, PickupStore, PricePoint } from './types';

export type SqlValue = string | number | null;
export interface SqlConnection {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}
export interface SqlDatabase extends SqlConnection {
  transaction<T>(work: (connection: SqlConnection) => Promise<T>): Promise<T>;
}
const defaults: LocalSettings = { notifications_enabled: true, check_interval_minutes: 15, background_enabled: true };
const storeSchema = pickupStoreSchema;
const snapshotSchema = z.object({
  price: z.number().finite().nonnegative().max(9999999999.99).nullable(),
  in_stock: z.boolean(), pickup_stores: z.array(storeSchema).max(500).optional(),
});
type ItemRow = Omit<Item, 'notify_stock' | 'notify_price' | 'in_stock' | 'pickup_stores'> & {
  notify_stock: number; notify_price: number; in_stock: number | null; pickup_stores: string;
};
function decodeItem(row: ItemRow): Item {
  return { ...row, notify_stock: row.notify_stock === 1, notify_price: row.notify_price === 1,
    in_stock: row.in_stock === null ? null : row.in_stock === 1,
    pickup_stores: z.array(storeSchema).parse(JSON.parse(row.pickup_stores)) };
}
function changedStores(previous: PickupStore[], next: PickupStore[]) {
  return previous.length !== next.length || next.some(store => !previous.some(old =>
    old.id === store.id && old.name === store.name && old.distance_miles === store.distance_miles && old.available === store.available));
}

export class LocalStore {
  constructor(readonly db: SqlDatabase, private readonly uuid: () => string, private readonly now = Date.now) {}
  async initialize() {
    await this.db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    await this.db.transaction(async tx => {
      const versions = await tx.all<{ user_version: number }>('PRAGMA user_version');
      if (versions[0].user_version > 1) throw new Error('Local database requires a newer app version');
      if (versions[0].user_version === 1) return;
      await tx.exec(`
        CREATE TABLE items (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT 'local',
          retailer TEXT NOT NULL, brand TEXT, model TEXT, sku TEXT, url TEXT,
          target_price REAL, current_price REAL, in_stock INTEGER,
          notify_stock INTEGER NOT NULL, notify_price INTEGER NOT NULL,
          fulfillment TEXT NOT NULL, pickup_zip TEXT, pickup_radius_miles INTEGER,
          pickup_stores TEXT NOT NULL DEFAULT '[]',
          last_checked_at TEXT, last_check_error TEXT, created_at TEXT NOT NULL
        );
        CREATE TABLE history (
          id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          price REAL, in_stock INTEGER NOT NULL, pickup_stores TEXT NOT NULL, checked_at TEXT NOT NULL
        );
        CREATE INDEX history_item ON history(item_id,checked_at DESC);
        CREATE TABLE notifications (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
          read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
          delivered INTEGER NOT NULL DEFAULT 0, delivery_error TEXT
        );
        CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
        CREATE TABLE monitor (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
          last_run_at TEXT, error TEXT);
        INSERT INTO monitor(id) VALUES(1);
        PRAGMA user_version=1;
      `);
      await tx.run('INSERT INTO settings(id,value) VALUES(1,?)', [JSON.stringify(defaults)]);
    });
  }
  async items(): Promise<Item[]> {
    return (await this.db.all<ItemRow>('SELECT * FROM items ORDER BY created_at DESC,id')).map(decodeItem);
  }
  async item(id: string): Promise<Item> {
    identifier.parse(id);
    const row = (await this.db.all<ItemRow>('SELECT * FROM items WHERE id=?', [id]))[0];
    if (!row) throw new Error('Tracked item not found');
    return decodeItem(row);
  }
  async addItem(input: unknown): Promise<Item> {
    const value = newItem.parse(input);
    const id = this.uuid();
    await this.db.run(`INSERT INTO items(id,retailer,brand,model,sku,url,target_price,notify_stock,notify_price,
      fulfillment,pickup_zip,pickup_radius_miles,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, value.retailer, value.brand ?? null, value.model ?? null, value.sku ?? null, value.url ?? null,
      value.target_price ?? null, Number(value.notify_stock), Number(value.notify_price), value.fulfillment,
      value.pickup_zip ?? null, value.pickup_radius_miles ?? null, new Date(this.now()).toISOString()]);
    return this.item(id);
  }
  async deleteItem(id: string) {
    await this.item(id);
    await this.db.run('DELETE FROM items WHERE id=?', [id]);
  }
  async prices(id: string): Promise<PricePoint[]> {
    await this.item(id);
    return this.readPrices(this.db, id);
  }
  private async readPrices(tx: SqlConnection, id: string): Promise<PricePoint[]> {
    const rows = await tx.all<Omit<PricePoint, 'in_stock' | 'pickup_stores'> & { in_stock: number; pickup_stores: string }>(
      'SELECT * FROM history WHERE item_id=? ORDER BY checked_at DESC,id DESC LIMIT 1000', [id]);
    return rows.map(row => ({ ...row, in_stock: row.in_stock === 1, pickup_stores: z.array(storeSchema).parse(JSON.parse(row.pickup_stores)) }));
  }
  async settings(): Promise<LocalSettings> {
    return this.readSettings(this.db);
  }
  private async readSettings(tx: SqlConnection): Promise<LocalSettings> {
    const row = (await tx.all<{ value: string }>('SELECT value FROM settings WHERE id=1'))[0];
    if (!row) throw new Error('Local settings are missing');
    return localSettings.parse(JSON.parse(row.value));
  }
  async saveSettings(value: unknown): Promise<LocalSettings> {
    const parsed = localSettings.parse(value);
    await this.db.run('UPDATE settings SET value=? WHERE id=1', [JSON.stringify(parsed)]);
    return parsed;
  }
  async notifications(pending = false): Promise<LocalNotification[]> {
    return this.readNotifications(this.db, pending);
  }
  private async readNotifications(tx: SqlConnection, pending = false): Promise<LocalNotification[]> {
    const rows = await tx.all<Omit<LocalNotification, 'read'> & { read: number }>(
      `SELECT id,title,body,read,created_at,delivery_error FROM notifications ${pending ? 'WHERE delivered=0 AND read=0' : ''}
      ORDER BY created_at DESC,id DESC LIMIT 1000`);
    return rows.map(row => ({ ...row, read: row.read === 1 }));
  }
  async markRead(id: string) {
    identifier.parse(id);
    if (!(await this.db.all('SELECT id FROM notifications WHERE id=?', [id])).length) throw new Error('Notification not found');
    await this.db.run('UPDATE notifications SET read=1 WHERE id=?', [id]);
  }
  async delivery(id: string, error: string | null) {
    await this.db.run('UPDATE notifications SET delivered=?,delivery_error=? WHERE id=?', [error === null ? 1 : 0, error, id]);
  }
  async applyResult(id: string, input: InventoryResult) {
    const result = snapshotSchema.parse(input);
    await this.db.transaction(async tx => {
      const row = (await tx.all<ItemRow>('SELECT * FROM items WHERE id=?', [id]))[0];
      if (!row) return;
      const current = decodeItem(row);
      const stores = result.pickup_stores ?? [];
      if (current.fulfillment === 'pickup' && (!result.pickup_stores
          || stores.some(store => store.distance_miles > current.pickup_radius_miles!)
          || new Set(stores.map(store => store.id)).size !== stores.length
          || result.in_stock !== stores.some(store => store.available))) {
        throw new Error('Pickup check returned invalid store availability');
      }
      const time = new Date(this.now()).toISOString();
      await tx.run('UPDATE items SET current_price=?,in_stock=?,pickup_stores=?,last_checked_at=?,last_check_error=NULL WHERE id=?',
        [result.price, Number(result.in_stock), JSON.stringify(stores), time, id]);
      if (current.current_price !== result.price || current.in_stock !== result.in_stock || changedStores(current.pickup_stores, stores)) {
        await tx.run('INSERT INTO history(id,item_id,price,in_stock,pickup_stores,checked_at) VALUES(?,?,?,?,?,?)',
          [this.uuid(), id, result.price, Number(result.in_stock), JSON.stringify(stores), time]);
      }
      const reason = notificationReason(current, result);
      if (reason && (await this.readSettings(tx)).notifications_enabled) {
        const title = [current.brand, current.model ?? current.sku ?? current.retailer].filter(Boolean).join(' ').slice(0, 120);
        await tx.run('INSERT INTO notifications(id,title,body,created_at) VALUES(?,?,?,?)',
          [this.uuid(), title, reason.slice(0, 1000), time]);
      }
    });
  }
  async checkFailed(id: string, error: string) {
    await this.db.run('UPDATE items SET last_checked_at=?,last_check_error=? WHERE id=?',
      [new Date(this.now()).toISOString(), error.slice(0, 300), id]);
  }
  async claim(owner: string): Promise<boolean> {
    return this.db.transaction(async tx => {
      const row = (await tx.all<{ lease_until: number; owner: string | null }>('SELECT owner,lease_until FROM monitor WHERE id=1'))[0];
      if (row.lease_until > this.now() && row.owner !== owner) return false;
      await tx.run('UPDATE monitor SET owner=?,lease_until=? WHERE id=1', [owner, this.now() + 120000]);
      return true;
    });
  }
  async finish(owner: string, error: string | null) {
    await this.db.run('UPDATE monitor SET owner=NULL,lease_until=0,last_run_at=?,error=? WHERE id=1 AND owner=?',
      [new Date(this.now()).toISOString(), error, owner]);
  }
  async status(): Promise<MonitorStatus> {
    return (await this.db.all<MonitorStatus>('SELECT last_run_at,error FROM monitor WHERE id=1'))[0];
  }
  async reportError(error: string) {
    await this.db.run('UPDATE monitor SET error=? WHERE id=1', [error.slice(0, 300)]);
  }
  async exportBackup(): Promise<string> {
    return this.db.transaction(async tx => {
      const items = [];
      for (const item of (await tx.all<ItemRow>('SELECT * FROM items ORDER BY created_at DESC,id')).map(decodeItem)) {
        items.push({
          id: item.id, product: itemInput(item), current_price: item.current_price, in_stock: item.in_stock,
          pickup_stores: item.pickup_stores, last_checked_at: item.last_checked_at, last_check_error: item.last_check_error,
          history: (await this.readPrices(tx, item.id)).map(point => ({
            id: point.id, price: point.price, in_stock: point.in_stock, pickup_stores: point.pickup_stores, checked_at: point.checked_at,
          })),
        });
      }
      const notifications = (await this.readNotifications(tx)).map(({ id, title, body, read, created_at }) => ({ id, title, body, read, created_at }));
      return serializeBackup({ version: 1, items, notifications });
    });
  }
  async importBackup(text: string): Promise<void> {
    const backup = parseBackup(text);
    if (new Set(backup.items.map(item => item.id)).size !== backup.items.length) throw new Error('Backup contains duplicate item IDs');
    await this.db.transaction(async tx => {
      for (const entry of backup.items) {
        if ((await tx.all('SELECT id FROM items WHERE id=?', [entry.id])).length) continue;
        const item = entry.product;
        if (item.fulfillment === 'pickup' && (entry.pickup_stores.some(store => store.distance_miles > item.pickup_radius_miles!)
            || entry.in_stock !== null && entry.in_stock !== entry.pickup_stores.some(store => store.available))) {
          throw new Error('Backup contains invalid pickup availability');
        }
        await tx.run(`INSERT INTO items(id,retailer,brand,model,sku,url,target_price,notify_stock,notify_price,
          fulfillment,pickup_zip,pickup_radius_miles,current_price,in_stock,pickup_stores,last_checked_at,last_check_error,created_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [entry.id, item.retailer, item.brand ?? null, item.model ?? null, item.sku ?? null, item.url ?? null,
          item.target_price ?? null, Number(item.notify_stock), Number(item.notify_price), item.fulfillment,
          item.pickup_zip ?? null, item.pickup_radius_miles ?? null, entry.current_price, entry.in_stock === null ? null : Number(entry.in_stock),
          JSON.stringify(entry.pickup_stores), entry.last_checked_at, entry.last_check_error, new Date(this.now()).toISOString()]);
        for (const point of entry.history) {
          await tx.run('INSERT INTO history(id,item_id,price,in_stock,pickup_stores,checked_at) VALUES(?,?,?,?,?,?)',
            [point.id, entry.id, point.price, Number(point.in_stock), JSON.stringify(point.pickup_stores), point.checked_at]);
        }
      }
      for (const alert of backup.notifications) {
        await tx.run('INSERT INTO notifications(id,title,body,read,created_at,delivered) VALUES(?,?,?,?,?,1) ON CONFLICT(id) DO NOTHING',
          [alert.id, alert.title, alert.body, Number(alert.read), alert.created_at]);
      }
    });
  }
}
