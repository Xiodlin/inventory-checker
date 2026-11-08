import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Notification, safeStorage } from 'electron';
import { LocalMonitor, LocalStore, ShoppingMonitor } from '@inventory-checker/core';
import { DesktopDatabase } from './database';
import { ShoppingService } from './shoppingService';

export class DesktopService {
  readonly store: LocalStore;
  readonly monitor: LocalMonitor;
  readonly shopping: ShoppingService;
  readonly shoppingMonitor: ShoppingMonitor;
  private readonly database: DesktopDatabase;
  private readonly keyPath: string;
  private readonly activeNotifications = new Set<Notification>();
  private checkGeneration = 0;
  constructor(directory: string, changed: () => void, openWindow: () => void) {
    this.database = new DesktopDatabase(join(directory, 'inventory.sqlite'));
    this.store = new LocalStore(this.database, randomUUID);
    this.shopping = new ShoppingService(this.database);
    this.shoppingMonitor = new ShoppingMonitor(this.store, randomUUID, input => this.shopping.search(input), changed);
    this.keyPath = join(directory, 'bestbuy-key.bin');
    this.monitor = new LocalMonitor(this.store, randomUUID(), () => this.getKey(),
      alert => this.showNotification(alert.title, alert.body, alert.id, openWindow), changed);
  }
  private async showNotification(title: string, body: string, id: string, openWindow?: () => void) {
    if (!Notification.isSupported()) throw new Error('Desktop notifications are unavailable on this device');
    const guidance = process.platform === 'darwin'
      ? ' Run npm run dev:desktop to use the signed local app, then enable Inventory Checker in System Settings > Notifications. Raw electron . builds may not request permission.'
      : ' Enable notifications for Inventory Checker in your operating system settings.';
    const notification = new Notification({ title, body, id });
    this.activeNotifications.add(notification);
    notification.once('close', () => this.activeNotifications.delete(notification));
    if (openWindow) notification.on('click', openWindow);
    await new Promise<void>((resolve, reject) => {
      const failed = (message: string) => {
        clearTimeout(timeout);
        this.activeNotifications.delete(notification);
        reject(new Error(message + guidance));
      };
      const timeout = setTimeout(() => {
        notification.close();
        failed('Desktop notification was not confirmed by the OS.');
      }, 60000);
      notification.once('show', () => { clearTimeout(timeout); resolve(); });
      notification.once('failed', (_event, error) => failed(`Desktop notification failed: ${error}.`));
      try { notification.show(); }
      catch (error) { failed(error instanceof Error ? error.message : 'Could not submit desktop notification.'); }
    });
  }
  async testNotification() {
    await this.showNotification('Inventory Checker', 'Test alert: local desktop notifications are working.', randomUUID());
  }
  async checkDue() {
    const generation = this.checkGeneration;
    if (!this.shopping.busy) await this.shoppingMonitor.tick();
    if (generation !== this.checkGeneration) {
      return { checked: 0, succeeded: 0, failed: 0, remaining: 0, reason: 'interrupted' as const };
    }
    return this.monitor.tick();
  }
  cancelChecks() { this.checkGeneration++; this.monitor.cancelRun(); this.shoppingMonitor.cancel(); this.shopping.cancel(); }
  async getKey(): Promise<string | undefined> {
    if (!existsSync(this.keyPath)) return undefined;
    if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
      throw new Error('OS credential encryption is unavailable');
    }
    return safeStorage.decryptString(await readFile(this.keyPath));
  }
  async saveKey(value: unknown) {
    if (typeof value !== 'string' || value.length > 1000) throw new Error('Invalid Best Buy API key');
    if (!value.trim()) {
      if (existsSync(this.keyPath)) await unlink(this.keyPath);
      return;
    }
    if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
      throw new Error('OS credential encryption is unavailable; the key was not stored');
    }
    await writeFile(this.keyPath, safeStorage.encryptString(value.trim()), { mode: 0o600 });
  }
  async close() {
    this.checkGeneration++;
    this.shoppingMonitor.cancel();
    await this.shopping.close();
    await this.shoppingMonitor.stop();
    await this.monitor.stop();
    for (const notification of this.activeNotifications) notification.close();
    this.activeNotifications.clear();
    await this.database.close();
  }
}
