import { checkInventory } from './scrapers/index';
import type { InventoryResult } from './scrapers/baseScraper';
import type { CheckResult, Item, LocalNotification } from './types';
import type { LocalStore } from './localStore';

export class LocalMonitor {
  private running?: Promise<CheckResult>;
  private manual?: Promise<CheckResult>;
  private stopped = false;
  private cancelled = false;
  private cancellation = 0;
  constructor(
    private readonly store: LocalStore, private readonly owner: string,
    private readonly key: () => Promise<string | undefined>,
    private readonly notify: (notification: LocalNotification) => Promise<void>,
    private readonly changed: () => void,
    private readonly checker: (item: Item, key?: string) => Promise<InventoryResult> = checkInventory,
    private readonly now = Date.now,
  ) {}
  checkNow(): Promise<CheckResult> {
    if (this.manual) return this.manual;
    const cancellation = this.cancellation;
    this.manual = (async () => {
      if (this.running) await this.running;
      if (this.cancellation !== cancellation && !this.stopped) {
        return { checked: 0, succeeded: 0, failed: 0, remaining: (await this.store.items()).length, reason: 'interrupted' as const };
      }
      return this.tick({ force: true, limit: Number.MAX_SAFE_INTEGER, budgetMs: Infinity });
    })().finally(() => { this.manual = undefined; });
    return this.manual;
  }
  tick(options: { background?: boolean; limit?: number; budgetMs?: number; force?: boolean } = {}): Promise<CheckResult> {
    if (this.stopped) return Promise.resolve({ checked: 0, succeeded: 0, failed: 0, remaining: 0, reason: 'stopped' });
    if (this.running) return this.running;
    this.running = this.run(options).finally(() => { this.running = undefined; });
    return this.running;
  }
  private async run(options: { background?: boolean; limit?: number; budgetMs?: number; force?: boolean }): Promise<CheckResult> {
    this.cancelled = false;
    const result: CheckResult = { checked: 0, succeeded: 0, failed: 0, remaining: 0, reason: 'complete' };
    const settings = await this.store.settings();
    if (options.background && !settings.background_enabled) return { ...result, reason: 'disabled' };
    if (!await this.store.claim(this.owner)) return { ...result, reason: 'busy' };
    let failure: string | null = null;
    try {
      const started = this.now();
      const eligible = (await this.store.items()).filter(item => options.force || !item.last_checked_at
        || new Date(item.last_checked_at).getTime() <= this.now() - settings.check_interval_minutes * 60000)
        .sort((a, b) => (a.last_checked_at ?? '').localeCompare(b.last_checked_at ?? ''));
      result.remaining = eligible.length;
      const due = eligible.slice(0, options.limit ?? 25);
      for (const item of due) {
        if (this.stopped || this.cancelled || this.now() - started >= (options.budgetMs ?? 60000)) break;
        if (!await this.store.claim(this.owner)) throw new Error('Local monitoring lease was lost');
        try {
          await this.store.applyResult(item.id, await this.checker(item, item.retailer === 'bestbuy' ? await this.key() : undefined));
          result.succeeded++;
        }
        catch (error) {
          const message = error instanceof Error ? error.message : 'Retailer check failed';
          await this.store.checkFailed(item.id, message);
          result.failed++;
        }
        result.checked++;
        result.remaining--;
        this.changed();
      }
      if ((await this.store.settings()).notifications_enabled) {
        for (const notification of await this.store.notifications(true)) {
          if (this.stopped || this.cancelled || this.now() - started >= (options.budgetMs ?? 60000)) break;
          if (!await this.store.claim(this.owner)) throw new Error('Local monitoring lease was lost');
          try {
            await this.notify(notification);
            await this.store.delivery(notification.id, null);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Device notification failed';
            await this.store.delivery(notification.id, message.slice(0, 300));
            failure = 'Some device notifications could not be delivered. Alerts are saved in Notifications.';
          }
        }
      }
      if (result.remaining) result.reason = 'interrupted';
      return result;
    } catch (error) {
      failure = error instanceof Error ? error.message : 'Local monitoring failed';
      throw error;
    } finally {
      await this.store.finish(this.owner, failure);
      this.changed();
    }
  }
  cancelRun() { this.cancelled = true; this.cancellation++; }
  async stop() { this.stopped = true; await this.running; }
}
