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
  const service = new DesktopService(directory, () => window?.webContents.send('inventory:changed'),
    target => { window?.show(); window?.webContents.send('inventory:notification-open', target ?? null); });
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
    const compactSettings = await window.webContents.executeJavaScript(`(async () => {
      const settings = [...document.querySelectorAll('nav button')].find(button => button.textContent.includes('Settings'));
      if (!settings) throw new Error('Settings navigation unavailable');
      settings.click();
      for (let attempt = 0; attempt < 50; attempt++) {
        const panel = document.querySelector('.settings');
        if (panel) {
          if (/Best Buy|How to get a key/.test(panel.innerText) || panel.querySelector('input[type="password"]')) {
            throw new Error('Best Buy key controls must be removed');
          }
          const sections = [...panel.querySelectorAll('.settings-details')];
          if (sections.length !== 2 || sections.some(section => section.open)) throw new Error('Settings help and backups must start collapsed');
          if (sections.some(section => section.getBoundingClientRect().height > 65)) throw new Error('Collapsed settings sections must be compact');
          const backup = sections[1];
          backup.querySelector('summary').click();
          if (!backup.open || !backup.innerText.includes('Export local backup')) throw new Error('Backup actions must be available on expansion');
          backup.querySelector('summary').click();
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error('Settings did not render');
    })()`);
    assert.equal(compactSettings, true);
    for (const width of [900, 1180]) {
      window.setSize(width, 900);
      const contained = await window.webContents.executeJavaScript(`(() => {
        const panel = document.querySelector('.settings').getBoundingClientRect();
        return [...document.querySelectorAll('.settings input, .settings button')].filter(element => element.getClientRects().length)
          .every(element => { const bounds = element.getBoundingClientRect(); return bounds.left >= panel.left && bounds.right <= panel.right; });
      })()`);
      assert.equal(contained, true, 'settings controls must fit at ' + width + 'px');
    }
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
    try {
      service.shopping.search = async input => {
        savedSearch = { id: 'shopping-fixture', input, checked_at: new Date().toISOString(), error: null,
          offers: [
            { title: 'MacBook Neo 256GB Indigo', seller: 'Target', price: '$699.99', url: 'https://www.google.com/aclk?tracking=' + 'long-tracking-value'.repeat(80),
              match: 'text-match', missing: [], availability: 'reported-in-stock', availability_text: 'Pickup today', sale_text: '20% off' },
            { title: 'MacBook Neo case', seller: 'Best Buy', price: '$49.99', url: 'https://www.bestbuy.com/site/case/12345.p',
              match: 'uncertain', missing: ['Product, not an accessory'], availability: 'unknown', availability_text: 'No unambiguous stock label' },
            { title: 'MacBook Neo 256GB Indigo', seller: 'Unknown shop', price: '$899.00', url: 'https://unknown-shop.com/item',
              match: 'text-match', missing: [], availability: 'unknown', availability_text: 'No unambiguous stock label' },
            { title: 'MacBook Neo 256GB Indigo', seller: 'Target', price: '$799.00', url: 'https://www.target.com/p/laptop/-/A-91122045',
              match: 'text-match', missing: [], availability: 'unknown', availability_text: 'No unambiguous stock label' },
          ] };
        return savedSearch;
      };
      const discovery = await window.webContents.executeJavaScript(`(async () => {
        [...document.querySelectorAll('nav button')].find(button => button.textContent.includes('Dashboard')).click();
        for (let attempt = 0; attempt < 50 && !document.querySelector('input[name="product"]'); attempt++) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        const collapsible = [...document.querySelectorAll('.discovery-collapse')];
        if (collapsible.some(section => section.open)) throw new Error('Search sections should start collapsed');
        if (collapsible.some(section => section.getBoundingClientRect().height > 90)) throw new Error('Collapsed search rows should stay compact');
        if (document.querySelector('.dashboard-add')) throw new Error('Only one add-product form should exist');
        document.querySelector('#discovery-title').closest('details').open = true;
        document.querySelector('input[name="product"]').value = 'MacBook Neo';
        document.querySelector('input[name="variants"]').value = '256GB, Indigo';
        document.querySelector('.discovery-form').requestSubmit();
        for (let attempt = 0; attempt < 50; attempt++) {
          if (document.body.innerText.includes('Product saved.')) return document.body.innerText;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw new Error('Discovery search did not render');
      })()`);
      assert.equal(savedSearch, undefined, 'adding a product must save a watch, not perform a one-time search');
      assert.match(discovery, /Product saved/);
      assert.equal((await service.shoppingMonitor.watches()).length, 1);
      assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.discovery-card .product-tags').innerText.includes('Stock unknown')`), true, 'a pending product must not report out of stock');
      const integrated = await window.webContents.executeJavaScript(`({
        products: document.body.innerText.includes('Tracked products'),
        shopping: !!document.querySelector('#discovery-title'),
        separateNavigation: [...document.querySelectorAll('nav button')].some(button => button.textContent === 'Find this product')
      })`);
      assert.equal(integrated.products, true);
      assert.equal(integrated.shopping, true);
      assert.equal(integrated.separateNavigation, false);
      const iconLoaded = await window.webContents.executeJavaScript(`(() => {
        const icon = document.querySelector('.brand img');
        return icon.complete && icon.naturalWidth > 0;
      })()`);
      assert.equal(iconLoaded, true, 'the stack-of-boxes icon must load in the packaged renderer');
      assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#discovery-results-title') === null && document.querySelector('#discovery-alerts-title') === null`), true);
      await service.checkDue();
      await window.webContents.executeJavaScript(`(async () => {
        for (let attempt = 0; attempt < 50; attempt++) {
          if (document.querySelector('.watch-details .discovery-link')) {
            const tags = document.querySelector('.discovery-card .product-tags');
            if (!tags.innerText.includes('In Stock') || !tags.innerText.includes('On Sale')) throw new Error('Product stock and sale tags must appear outside collapsed details');
            if (!tags.innerText.includes('Lowest found: $699.99')) throw new Error('Lowest price must exclude the cheaper uncertain accessory and appear on the product card');
            document.querySelector('.watch-details').open = true; return;
          }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw new Error('Watchlist offers did not render');
      })()`);
      const offerControls = await window.webContents.executeJavaScript(`(async () => {
        const details = document.querySelector('.watch-details');
        const [sort, seller] = details.querySelectorAll('.offer-controls select');
        const titles = () => [...details.querySelectorAll(':scope > .vendor-groups .discovery-price')].map(node => node.textContent);
        const groups = [...details.querySelectorAll(':scope > .vendor-groups > .vendor-group')];
        if (groups.length !== 2 || groups.some(group => group.open)) throw new Error('Vendors must start collapsed and consolidate repeated listings');
        if (!groups[0].querySelector('summary').innerText.includes('2 listings')) throw new Error('Target listings must share a vendor heading');
        groups[0].querySelector('summary').click();
        if (!groups[0].open) throw new Error('Vendor heading must expand its listings');
        sort.value = 'price-desc'; sort.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 30));
        const descending = titles();
        sort.value = 'price-asc'; sort.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 30));
        const ascending = titles();
        seller.value = 'unassessed'; seller.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 30));
        const filtered = titles();
        seller.value = 'verified'; seller.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 30));
        const empty = details.innerText.includes('No required-text matches for this filter.');
        seller.value = 'all'; seller.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 30));
        details.querySelectorAll('.vendor-group').forEach(group => { group.open = true; });
        return { descending, ascending, filtered, empty };
      })()`);
      assert.deepEqual(offerControls.descending, ['$799.00', '$699.99', '$899.00']);
      assert.deepEqual(offerControls.ascending, ['$699.99', '$799.00', '$899.00']);
      assert.deepEqual(offerControls.filtered, ['$899.00']);
      assert.equal(offerControls.empty, true);
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
          return { sections: sections.length, separated: rects.slice(1).every((rect, index) => rect.top - rects[index].bottom >= 12),
            overflow: document.documentElement.scrollWidth > window.innerWidth,
            hiddenLink, selectable, contained };
        })()`);
        assert.equal(layout.sections, 2);
        assert.equal(layout.separated, true, 'results, alerts and history must have distinct panel spacing');
        assert.equal(layout.overflow, false, 'long offer URLs must not overflow the page');
        assert.equal(layout.hiddenLink, true, 'tracking links must be collapsed by default');
        assert.equal(layout.selectable, true, 'clicking an offer link must select the full URL for copying');
        assert.equal(layout.contained, true);
      }
      assert.deepEqual([...savedSearch.input.variants].sort(), ['256GB', 'Indigo'].sort());
      const retainedForm = await window.webContents.executeJavaScript(`(() => {
        const section = document.querySelector('#discovery-title').closest('details');
        document.querySelector('input[name="product"]').value = 'MacBook Neo';
        section.open = false;
        section.open = true;
        return document.querySelector('input[name="product"]').value;
      })()`);
      assert.equal(retainedForm, 'MacBook Neo', 'collapsing a form must retain entered values');
      assert.equal((await service.shoppingMonitor.watches()).length, 1);
      const automaticShow = Notification.prototype.show;
      const automaticClose = Notification.prototype.close;
      let automaticAlerts = 0;
      let nativeAlert;
      try {
        Notification.prototype.show = function () { automaticAlerts++; nativeAlert = this; setImmediate(() => this.emit('show')); };
        Notification.prototype.close = function () { this.emit('close'); };
        await service.store.saveSettings({ notifications_enabled: true, check_interval_minutes: 15, background_enabled: true });
        await service.checkNow();
        assert.equal(automaticAlerts, 1, 'scheduled saved-search checks must use native desktop notifications');
        assert.equal((await service.store.notifications()).length, 1);
        await service.checkDue();
        assert.equal(automaticAlerts, 1, 'subsequent minute ticks must neither recheck early nor resend delivered alerts');
        const target = (await service.store.notifications())[0].target;
        const linked = await window.webContents.executeJavaScript(`(async () => {
          [...document.querySelectorAll('nav button')].find(button => button.textContent.includes('Notifications')).click();
          for (let attempt = 0; attempt < 100; attempt++) {
            const button = document.querySelector('.notification-open');
            if (button) { button.click(); break; }
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          for (let attempt = 0; attempt < 100; attempt++) {
            const card = document.querySelector('.notification-target');
            if (card && card.querySelector('.watch-details')?.open) return card.id;
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          throw new Error('Notification did not focus the linked shopping card');
        })()`);
        assert.equal(linked, 'product-shopping-' + target.id);
        assert.equal((await service.store.notifications())[0].read, true);
        await window.webContents.executeJavaScript(`[...document.querySelectorAll('nav button')].find(button => button.textContent.includes('Settings')).click()`);
        nativeAlert.emit('click');
        const nativeLinked = await window.webContents.executeJavaScript(`(async () => {
          for (let attempt = 0; attempt < 100; attempt++) {
            const card = document.querySelector('.notification-target');
            if (card) return card.id;
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          throw new Error('OS notification click did not focus a product');
        })()`);
        assert.equal(nativeLinked, linked);
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
      await service.checkNow();
      const blockedFeedback = await window.webContents.executeJavaScript(`(async () => {
        for (let attempt = 0; attempt < 50; attempt++) {
          if (document.body.innerText.includes('Google requires verification. Search stopped.')) {
            return !!document.querySelector('.watch-details .discovery-link');
          }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        return false;
      })()`);
      assert.equal(blockedFeedback, true, 'blocked searches must show an error while retaining last successful offers in watchlist details');
      await window.webContents.executeJavaScript(`(async () => {
        [...document.querySelectorAll('button')].find(button => button.textContent === 'Remove product').click();
        for (let attempt = 0; attempt < 50 && document.querySelector('.watch-details'); attempt++) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      })()`);
      assert.equal((await service.shoppingMonitor.watches()).length, 0);
    } finally {
      service.shopping.search = originalSearch;
    }
    const alertCount = (await service.store.notifications()).length;
    assert.ok(alertCount > 0, 'clear-notification fixture needs saved alerts');
    await service.store.db.run('INSERT INTO notifications(id,title,body,created_at,target) VALUES(?,?,?,?,?)',
      [randomUUID(), 'Direct product alert', 'Open direct product', new Date().toISOString(),
        JSON.stringify({ kind: 'item', id: (await service.store.items())[0].id })]);
    window.webContents.send('inventory:changed');
    const individual = await window.webContents.executeJavaScript(`(async () => {
      const wait = () => new Promise(resolve => setTimeout(resolve, 30));
      const nav = () => [...document.querySelectorAll('nav button')].find(button => button.textContent.includes('Notifications')).click();
      nav(); await wait();
      const button = [...document.querySelectorAll('.notification-open')].find(button => button.textContent.includes('Direct product alert'));
      if (!button) throw new Error('Direct notification did not render');
      button.click();
      for (let attempt = 0; attempt < 100 && !document.querySelector('tr.notification-target'); attempt++) await wait();
      if (!document.querySelector('tr.notification-target')) throw new Error('Direct alert did not navigate to its row');
      nav(); await wait();
      const removed = [...document.querySelectorAll('.notification-open')].find(button => button.textContent.includes('Google reports stock'));
      removed.click(); await wait();
      if (!document.body.innerText.includes('has been removed')) throw new Error('Removed product needs explicit fallback');
      nav(); await wait();
      const before = (await window.inventoryDesktop.notifications()).length;
      [...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Dismiss Direct product alert').click();
      for (let attempt = 0; attempt < 100; attempt++) {
        const count = (await window.inventoryDesktop.notifications()).length;
        const clearButton = [...document.querySelectorAll('button')].find(button => button.textContent === 'Clear notifications');
        if (count === before - 1 && clearButton && !clearButton.disabled
          && ![...document.querySelectorAll('button')].some(button => button.getAttribute('aria-label') === 'Dismiss Direct product alert')) return count;
        await wait();
      }
      throw new Error('Individual dismissal failed');
    })()`);
    assert.equal(individual, alertCount);
    await service.store.db.run('INSERT INTO notifications(id,title,body,created_at) VALUES(?,?,?,?)',
      [randomUUID(), 'Legacy alert', 'No saved link', new Date().toISOString()]);
    window.webContents.send('inventory:changed');
    await window.webContents.executeJavaScript(`(async () => {
      const wait = () => new Promise(resolve => setTimeout(resolve, 30));
      for (let attempt = 0; attempt < 100; attempt++) {
        const button = [...document.querySelectorAll('.notification-open')].find(button => button.textContent.includes('Legacy alert'));
        if (button) { button.click(); break; }
        await wait();
      }
      for (let attempt = 0; attempt < 100; attempt++) {
        if (document.body.innerText.includes('older notification has no product link')) return;
        await wait();
      }
      throw new Error('Legacy alert must open dashboard without guessing a product');
    })()`);
    const cleared = await window.webContents.executeJavaScript(`(async () => {
      [...document.querySelectorAll('nav button')].find(button => button.textContent.includes('Notifications')).click();
      const wait = () => new Promise(resolve => setTimeout(resolve, 30));
      for (let attempt = 0; attempt < 50 && ![...document.querySelectorAll('button')].some(button => button.textContent === 'Clear notifications'); attempt++) await wait();
      const click = text => {
        const button = [...document.querySelectorAll('button')].find(button => button.textContent === text);
        if (!button) throw new Error('Missing notification action: ' + text);
        button.click();
      };
      click('Clear notifications'); await wait();
      const before = (await window.inventoryDesktop.notifications()).length;
      click('Cancel'); await wait();
      if ((await window.inventoryDesktop.notifications()).length !== before) throw new Error('Cancel deleted alerts');
      click('Clear notifications'); await wait();
      click('Delete all notifications');
      for (let attempt = 0; attempt < 100; attempt++) {
        if (document.body.innerText.includes("You're all caught up") && !document.querySelector('.nav-count')) {
          return { count: (await window.inventoryDesktop.notifications()).length,
            disabled: [...document.querySelectorAll('button')].find(button => button.textContent === 'Clear notifications').disabled,
            cursor: getComputedStyle([...document.querySelectorAll('button')].find(button => button.textContent === 'Clear notifications')).cursor };
        }
        await wait();
      }
      throw new Error('Cleared notifications and unread count did not refresh');
    })()`);
    assert.equal(cleared.count, 0);
    assert.equal(cleared.disabled, true);
    assert.equal(cleared.cursor, 'default', 'an empty notification list must not show a loading cursor');
    assert.equal((await service.store.notifications(true)).length, 0);
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
