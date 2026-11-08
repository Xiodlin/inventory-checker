import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { fetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { checkInventory, LocalMonitor, LocalStore, type SqlConnection, type SqlDatabase, type SqlValue } from '@inventory-checker/core';

function connection(database: SQLiteDatabase): SqlConnection {
  return {
    exec: sql => database.execAsync(sql),
    run: async (sql, params = []) => { await database.runAsync(sql, params); },
    all: <T>(sql: string, params: SqlValue[] = []) => database.getAllAsync<T>(sql, params),
  };
}
function adapter(database: SQLiteDatabase): SqlDatabase {
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work);
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
  const sql = connection(database);
  return {
    exec: text => serialize(() => sql.exec(text)),
    run: (text, params) => serialize(() => sql.run(text, params)),
    all: <T>(text: string, params?: SqlValue[]) => serialize(() => sql.all<T>(text, params)),
    transaction: <T>(work: (tx: SqlConnection) => Promise<T>) => serialize(async () => {
      // Keep foreign-key and timeout settings on this dedicated connection.
      await sql.exec('BEGIN IMMEDIATE');
      try {
        const result = await work(sql);
        await sql.exec('COMMIT');
        return result;
      } catch (error) {
        await sql.exec('ROLLBACK');
        throw error;
      }
    }),
  };
}

const keyName = 'inventory-checker.bestbuy-key';
const listeners = new Set<() => void>();
const changed = () => { for (const listener of listeners) listener(); };
let runtime: Promise<{ store: LocalStore; monitor: LocalMonitor }> | undefined;
export function subscribeLocal(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export async function getKey() {
  return await SecureStore.getItemAsync(keyName) ?? undefined;
}
export async function saveKey(value: string) {
  if (value.length > 1000) throw new Error('Best Buy API key is too long');
  if (!value.trim()) await SecureStore.deleteItemAsync(keyName);
  else await SecureStore.setItemAsync(keyName, value.trim(), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
}
export function localRuntime() {
  if (!runtime) {
    runtime = (async () => {
      const database = await openDatabaseAsync('inventory.sqlite', { useNewConnection: true });
      const store = new LocalStore(adapter(database), randomUUID);
      try { await store.initialize(); }
      catch (error) { await database.closeAsync(); throw error; }
      const monitor = new LocalMonitor(store, randomUUID(), getKey, async notification => {
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
          throw new Error('Notification permission is disabled. Your alert is saved in the app.');
        }
        await Notifications.scheduleNotificationAsync({
          identifier: notification.id,
          content: { title: notification.title, body: notification.body, data: { notificationId: notification.id } },
          trigger: Platform.OS === 'android' ? { channelId: 'inventory' } : null,
        });
      }, changed, (item, key) => checkInventory(item, key, fetch));
      return { store, monitor };
    })().catch(error => { runtime = undefined; throw error; });
  }
  return runtime;
}
