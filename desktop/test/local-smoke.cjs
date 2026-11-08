const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtemp, readdir, unlink, rmdir } = require('node:fs/promises');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, ipcMain, Notification } = require('electron');

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const { DesktopService } = require('../dist/main/localService.js');
  const { registerIpcHandlers } = require('../dist/main/ipcHandlers.js');
  const directory = await mkdtemp(join(tmpdir(), 'inventory-electron-test-'));
  const renderer = resolve(__dirname, '../dist/renderer/public/index.html');
  let window;
  const service = new DesktopService(directory, () => window?.webContents.send('inventory:changed'), () => {});
  try {
    await service.store.initialize();
    await service.store.saveSettings({ notifications_enabled: false, check_interval_minutes: 15, background_enabled: true });
    window = new BrowserWindow({ show: false, webPreferences: {
      preload: resolve(__dirname, '../dist/main/preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    } });
    registerIpcHandlers(() => window, pathToFileURL(renderer).href, service);
    await window.loadFile(renderer);
    const output = await window.webContents.executeJavaScript(`(async () => {
      const api = window.inventoryDesktop;
      if (!api) throw new Error('Sandboxed preload unavailable');
      const item = await api.addItem({ retailer: 'bestbuy', sku: '12345', notify_stock: true, notify_price: false, fulfillment: 'shipping' });
      const first = await api.check();
      const second = await api.check();
      const updated = await api.item(item.id);
      return { count: (await api.items()).length, error: updated.last_check_error,
        first, second,
        local: document.body.innerText.includes('Local SQLite storage'), login: document.body.innerText.includes('Sign in'),
        node: typeof require };
    })()`);
    assert.equal(output.count, 1);
    assert.match(output.error, /not configured/);
    assert.equal(output.local, true);
    assert.equal(output.login, false);
    assert.equal(output.node, 'undefined');
    assert.equal(output.first.failed, 1);
    assert.equal(output.second.checked, 1, 'manual checking must retry a recently failed product');
    const manualFeedback = await window.webContents.executeJavaScript(`(async () => {
      const button = [...document.querySelectorAll('button')].find(button => button.textContent === 'Check now');
      if (!button) throw new Error('Manual check button unavailable');
      button.click();
      for (let attempt = 0; attempt < 100; attempt++) {
        if (document.body.innerText.includes('Checked 1 products: 0 succeeded, 1 failed.')) return true;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error('Manual-check feedback did not render');
    })()`);
    assert.equal(manualFeedback, true);
    const keyHelp = await window.webContents.executeJavaScript(`(async () => {
      const settings = [...document.querySelectorAll('nav button')].find(button => button.textContent.includes('Settings'));
      if (!settings) throw new Error('Settings navigation unavailable');
      settings.click();
      for (let attempt = 0; attempt < 50; attempt++) {
        const help = [...document.querySelectorAll('button')].find(button => button.textContent === 'How to get a key');
        if (help) {
          const dialog = document.querySelector('dialog');
          if (dialog.open) throw new Error('Key help should start closed');
          help.focus();
          help.click();
          if (!dialog.matches(':modal')) throw new Error('Key help is not a modal');
          return dialog.innerText;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error('Key instructions did not render');
    })()`);
    assert.match(keyHelp, /https:\/\/developer\.bestbuy\.com\//);
    assert.match(keyHelp, /Get API Key/);
    assert.match(keyHelp, /not your Best Buy password/);
    assert.match(keyHelp, /Amazon, Target, and Apple checks do not require API keys/);
    const closed = await window.webContents.executeJavaScript(`(() => {
      const dialog = document.querySelector('dialog');
      dialog.querySelector('button').click();
      return !dialog.open && document.activeElement.textContent === 'How to get a key';
    })()`);
    assert.equal(closed, true, 'closing key help must restore focus to its button');
    const originalShow = Notification.prototype.show;
    const originalClose = Notification.prototype.close;
    const created = [];
    try {
      Notification.prototype.show = function () {
        created.push(this);
        setImmediate(() => this.emit('show'));
      };
      Notification.prototype.close = function () { this.emit('close'); };
      const testFeedback = await window.webContents.executeJavaScript(`(async () => {
        const button = [...document.querySelectorAll('button')].find(button => button.textContent === 'Test desktop notification');
        if (!button) throw new Error('Test notification button unavailable');
        button.click();
        for (let attempt = 0; attempt < 100; attempt++) {
          if (document.body.innerText.includes('The OS accepted the test notification.')) return true;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw new Error('Test notification result did not render');
      })()`);
      assert.equal(testFeedback, true);
      assert.equal(created.length, 1);
      assert.equal((await service.store.settings()).notifications_enabled, false, 'test must not enable automatic alerts');
      Notification.prototype.show = function () {
        created.push(this);
        setImmediate(() => this.emit('failed', {}, 'Permission denied'));
      };
      const failure = await window.webContents.executeJavaScript(`window.inventoryDesktop.testNotification().then(
        () => { throw new Error('A failed native notification must reject'); }, error => error.message)`);
      assert.match(failure, /Permission denied/);
      assert.match(failure, process.platform === 'darwin' ? /signed local app/ : /operating system settings/);
      created[0].close();
    } finally {
      Notification.prototype.show = originalShow;
      Notification.prototype.close = originalClose;
    }
    const originalSearch = service.shopping.search.bind(service.shopping);
    let savedSearch;
    const originalHistory = service.shopping.history.bind(service.shopping);
    const originalClear = service.shopping.clearHistory.bind(service.shopping);
    try {
      service.shopping.search = async input => {
        savedSearch = { id: 'shopping-fixture', input, checked_at: new Date().toISOString(), error: null,
          offers: [
            { title: 'MacBook Neo 256GB Indigo', seller: 'Target', price: '$699.99', url: 'https://www.google.com/aclk?tracking=' + 'long-tracking-value'.repeat(80),
              match: 'text-match', missing: [], availability: 'reported-in-stock', availability_text: 'Pickup today' },
            { title: 'MacBook Neo case', seller: 'Best Buy', price: '$49.99', url: 'https://www.bestbuy.com/site/case/12345.p',
              match: 'uncertain', missing: ['Product, not an accessory'], availability: 'unknown', availability_text: 'No unambiguous stock label' },
          ] };
        return savedSearch;
      };
      service.shopping.history = async () => savedSearch ? [savedSearch] : [];
      service.shopping.clearHistory = async () => { savedSearch = undefined; };
      const discovery = await window.webContents.executeJavaScript(`(async () => {
        [...document.querySelectorAll('nav button')].find(button => button.textContent === 'Find this product').click();
        for (let attempt = 0; attempt < 50 && !document.querySelector('input[name="product"]'); attempt++) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        document.querySelector('input[name="product"]').value = 'MacBook Neo';
        document.querySelector('input[name="variants"]').value = '256GB, Indigo';
        document.querySelector('.discovery-form').requestSubmit();
        for (let attempt = 0; attempt < 50; attempt++) {
          if (document.body.innerText.includes('Found 2 readable offers.')) {
            return { text: document.body.innerText, uncertainClosed: !document.querySelector('.discovery-uncertain').open };
          }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw new Error('Discovery search did not render');
      })()`);
      assert.match(discovery.text, /Google-reported availability/);
      assert.match(discovery.text, /not retailer-verified/);
      assert.equal(discovery.uncertainClosed, true);
      for (const width of [1180, 900]) {
        window.setSize(width, 900);
        await new Promise(resolve => setTimeout(resolve, 100));
        const layout = await window.webContents.executeJavaScript(`(async () => {
          const sections = [...document.querySelectorAll('.discovery-section')];
          const rects = sections.map(section => section.getBoundingClientRect());
          const link = document.querySelector('.discovery-link');
          const hiddenLink = !link.open;
          link.open = true;
          const input = link.querySelector('input');
          input.focus();
          input.click();
          await new Promise(resolve => setTimeout(resolve, 20));
          const selectable = input.selectionStart === 0 && input.selectionEnd === input.value.length;
          const contained = input.getBoundingClientRect().right <= input.closest('.discovery-card').getBoundingClientRect().right;
          input.blur();
          link.open = false;
          return { sections: sections.length, separated: rects.slice(1).every((rect, index) => rect.top - rects[index].bottom >= 20),
            overflow: document.documentElement.scrollWidth > window.innerWidth,
            hiddenLink, selectable, contained };
        })()`);
        assert.equal(layout.sections, 4);
        assert.equal(layout.separated, true, 'results, alerts and history must have distinct panel spacing');
        assert.equal(layout.overflow, false, 'long offer URLs must not overflow the page');
        assert.equal(layout.hiddenLink, true, 'tracking links must be collapsed by default');
        assert.equal(layout.selectable, true, 'clicking an offer link must select the full URL for copying');
        assert.equal(layout.contained, true);
      }
      assert.deepEqual(savedSearch.input.variants, ['256GB', 'Indigo']);
      const savedWatch = await window.webContents.executeJavaScript(`(async () => {
        [...document.querySelectorAll('button')].find(button => button.textContent === 'Save search for stock alerts').click();
        for (let attempt = 0; attempt < 50; attempt++) {
          if (document.body.innerText.includes('Pending check')) return true;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        return false;
      })()`);
      assert.equal(savedWatch, true, 'saving from the form must persist a watch without needing a successful search');
      assert.equal((await service.shoppingMonitor.watches()).length, 1);
      const automaticShow = Notification.prototype.show;
      const automaticClose = Notification.prototype.close;
      let automaticAlerts = 0;
      try {
        Notification.prototype.show = function () { automaticAlerts++; setImmediate(() => this.emit('show')); };
        Notification.prototype.close = function () { this.emit('close'); };
        await service.store.saveSettings({ notifications_enabled: true, check_interval_minutes: 15, background_enabled: true });
        await service.checkDue();
        assert.equal(automaticAlerts, 1, 'scheduled saved-search checks must use native desktop notifications');
        assert.equal((await service.store.notifications()).length, 1);
        await service.checkDue();
        assert.equal(automaticAlerts, 1, 'subsequent minute ticks must neither recheck early nor resend delivered alerts');
      } finally {
        Notification.prototype.show = automaticShow;
        Notification.prototype.close = automaticClose;
        await service.store.saveSettings({ notifications_enabled: false, check_interval_minutes: 15, background_enabled: true });
      }
      service.shopping.search = async input => {
        savedSearch = { id: 'blocked-fixture', input, checked_at: new Date().toISOString(), offers: [],
          error: 'Google requires verification. Search stopped.' };
        return savedSearch;
      };
      const blockedFeedback = await window.webContents.executeJavaScript(`(async () => {
        document.querySelector('.discovery-form').requestSubmit();
        for (let attempt = 0; attempt < 50; attempt++) {
          if (document.body.innerText.includes('Google requires verification. Search stopped.')) {
            return !document.body.innerText.includes('Found 2 readable offers.');
          }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        return false;
      })()`);
      assert.equal(blockedFeedback, true, 'blocked searches must replace old offers with an explicit error');
      const cleared = await window.webContents.executeJavaScript(`(async () => {
        [...document.querySelectorAll('button')].find(button => button.textContent === 'Clear shopping search history').click();
        for (let attempt = 0; attempt < 50; attempt++) {
          if (!document.body.innerText.includes('Google requires verification. Search stopped.')) return true;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        return false;
      })()`);
      assert.equal(cleared, true);
      assert.equal((await service.shoppingMonitor.watches()).length, 1, 'clearing history must not remove saved alerts');
      await window.webContents.executeJavaScript(`window.inventoryDesktop.removeShoppingWatch(${JSON.stringify((await service.shoppingMonitor.watches())[0].id)})`);
      assert.equal((await service.shoppingMonitor.watches()).length, 0);
    } finally {
      service.shopping.search = originalSearch;
      service.shopping.history = originalHistory;
      service.shopping.clearHistory = originalClear;
    }
    const foreign = new BrowserWindow({ show: false, webPreferences: { preload: resolve(__dirname, '../dist/main/preload.js'), sandbox: true } });
    await foreign.loadURL('data:text/html,<h1>Foreign page</h1>');
    const rejected = await foreign.webContents.executeJavaScript(`window.inventoryDesktop.items().then(() => false, () => true)`);
    assert.equal(rejected, true);
    foreign.destroy();
    console.log('Electron smoke passed: sandboxed SQLite IPC, no server/login, retailer errors, and untrusted-sender rejection.');
  } finally {
    window?.destroy();
    ipcMain.removeHandler('inventory:local');
    await service.close();
    for (const file of await readdir(directory)) await unlink(join(directory, file));
    await rmdir(directory);
  }
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
