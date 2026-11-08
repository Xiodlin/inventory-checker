import { randomUUID } from 'node:crypto';
import { BrowserWindow, session } from 'electron';
import type { SqlDatabase } from '@inventory-checker/core';
import { extractShoppingCards, isPublicShoppingURL, isShoppingNavigation, matchShoppingCards, shoppingBlocked, shoppingInput, shoppingURL,
  type ShoppingCard, type ShoppingSearch } from './shoppingTypes';

export class ShoppingService {
  private window?: BrowserWindow;
  private running?: Promise<ShoppingSearch>;
  private closed = false;
  private generation = 0;
  constructor(private readonly db: SqlDatabase) {}
  private async initialize() {
    await this.db.exec(`CREATE TABLE IF NOT EXISTS shopping_searches (
      id TEXT PRIMARY KEY, checked_at TEXT NOT NULL, result TEXT NOT NULL
    )`);
  }
  async history(): Promise<ShoppingSearch[]> {
    await this.initialize();
    const rows = await this.db.all<{ result: string }>('SELECT result FROM shopping_searches ORDER BY checked_at DESC LIMIT 20');
    return rows.map(row => JSON.parse(row.result) as ShoppingSearch);
  }
  async clearHistory() {
    if (this.running) throw new Error('Wait for the shopping search to finish before clearing its history.');
    await this.initialize();
    await this.db.run('DELETE FROM shopping_searches');
  }
  search(value: unknown): Promise<ShoppingSearch> {
    const input = shoppingInput.parse(value);
    if (this.closed) throw new Error('Shopping search is closed. Reopen the app.');
    if (this.running) throw new Error('A shopping search is already running.');
    this.running = this.perform(input).finally(() => { this.running = undefined; });
    return this.running;
  }
  private async perform(input: ShoppingSearch['input']): Promise<ShoppingSearch> {
    const generation = this.generation;
    const result: ShoppingSearch = { id: randomUUID(), input, checked_at: new Date().toISOString(), offers: [], error: null };
    const partition = `shopping-${result.id}`;
    const isolated = session.fromPartition(partition, { cache: false });
    let window: BrowserWindow | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let responseFailure: string | undefined;
    try {
      await this.initialize();
      if (this.closed || generation !== this.generation) throw new Error('Shopping search was cancelled.');
      isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      isolated.setPermissionCheckHandler(() => false);
      isolated.on('will-download', event => event.preventDefault());
      isolated.webRequest.onBeforeRequest((details, callback) => {
        callback({ cancel: !isPublicShoppingURL(details.url) && !details.url.startsWith('data:') && !details.url.startsWith('blob:') });
      });
      isolated.webRequest.onHeadersReceived((details, callback) => {
        if (details.resourceType === 'mainFrame' && details.statusCode >= 400) {
          responseFailure = `Google returned HTTP ${details.statusCode}. Search stopped; no verification bypass is attempted.`;
        }
        callback({});
      });
      window = new BrowserWindow({ show: false, webPreferences: {
        session: isolated, sandbox: true, contextIsolation: true, nodeIntegration: false,
        webSecurity: true, backgroundThrottling: false,
      } });
      this.window = window;
      const page = window.webContents;
      let blockedRedirect = false;
      page.setWindowOpenHandler(() => ({ action: 'deny' }));
      page.on('will-navigate', (event, url) => {
        if (!isShoppingNavigation(url)) { blockedRedirect = true; event.preventDefault(); }
      });
      page.on('will-attach-webview', event => event.preventDefault());
      page.on('will-redirect', (event, url) => {
        if (!isShoppingNavigation(url)) { blockedRedirect = true; event.preventDefault(); }
      });
      const expired = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('Google search timed out after 30 seconds. No availability was inferred.'));
          window?.destroy();
        }, 30000);
      });
      const load = (async () => {
        try { await page.loadURL(shoppingURL(input).href); }
        catch (error) {
          if (responseFailure) throw new Error(responseFailure);
          if (blockedRedirect) throw new Error('Google redirected to verification, consent, or an unsupported page. Search stopped without bypassing it.');
          if (error instanceof Error && error.message.includes('ERR_ABORTED')) {
            throw new Error('Google interrupted or redirected the search before results could be read. No availability was inferred; no verification bypass is attempted.');
          }
          throw error;
        }
        if (responseFailure) throw new Error(responseFailure);
        for (let attempt = 0; attempt < 12; attempt++) {
          if (this.closed || generation !== this.generation || page.isDestroyed()) throw new Error('Shopping search was cancelled.');
          const text: string = await page.executeJavaScript('document.body?.innerText?.slice(0, 20000) ?? ""');
          if (shoppingBlocked(page.getURL(), text)) throw new Error('Google requires verification or consent. Search stopped; no CAPTCHA, sign-in, or consent automation is attempted.');
          if (!isShoppingNavigation(page.getURL())) throw new Error('Google redirected outside the allowed search page. Search stopped.');
          const cards: ShoppingCard[] = await page.executeJavaScript(`(${extractShoppingCards.toString()})()`);
          const offers = matchShoppingCards(cards, input);
          if (offers.length) return offers;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error('No readable shopping offer cards were found. Google may have changed its layout or withheld results; no availability was inferred.');
      })();
      result.offers = await Promise.race([load, expired]);
    } catch (error) {
      result.error = this.closed || generation !== this.generation ? 'Shopping search was cancelled.'
        : error instanceof Error ? error.message.slice(0, 500) : 'Shopping search failed';
      console.warn('Shopping search failed:', result.error);
    } finally {
      clearTimeout(timeout);
      if (window && !window.isDestroyed()) window.destroy();
      this.window = undefined;
      await isolated.clearStorageData();
      await isolated.clearCache();
    }
    result.checked_at = new Date().toISOString();
    await this.db.transaction(async tx => {
      await tx.run('INSERT INTO shopping_searches(id,checked_at,result) VALUES(?,?,?)', [result.id, result.checked_at, JSON.stringify(result)]);
      await tx.run('DELETE FROM shopping_searches WHERE id NOT IN (SELECT id FROM shopping_searches ORDER BY checked_at DESC LIMIT 20)');
    });
    return result;
  }
  cancel() {
    this.generation++;
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
  }
  async close() { this.closed = true; this.cancel(); await this.running; }
}
