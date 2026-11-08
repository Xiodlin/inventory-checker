const assert = require('node:assert/strict');
const { app, BrowserWindow } = require('electron');
const { resolve } = require('node:path');
const { readFileSync } = require('node:fs');
const { transformFileSync } = require('@babel/core');
const { runInNewContext } = require('node:vm');
const { DesktopDatabase } = require('../dist/main/database');
const { LocalStore } = require('@inventory-checker/core');
const { randomUUID } = require('node:crypto');
const { ShoppingService } = require('../dist/main/shoppingService');
const { shoppingInput, shoppingURL, isPublicShoppingURL, isShoppingNavigation, shoppingBlocked, matchShoppingCards } = require('../dist/main/shoppingTypes');

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const input = { product: 'MacBook Neo', variants: ['256GB', 'Indigo'] };
  assert.equal(shoppingURL(input).searchParams.get('q'), 'MacBook Neo 256GB Indigo');
  for (const value of ['http://www.google.com/search', 'https://www.google.com.evil.example/search',
    'https://accounts.google.com/', 'https://www.google.com/sorry/index', 'https://www.google.com:444/search']) {
    assert.equal(isShoppingNavigation(value), false);
  }
  assert.equal(shoppingBlocked('https://www.google.com/search', 'Our systems detected unusual traffic'), true);
  assert.equal(shoppingBlocked('https://www.google.com/sorry/index', ''), true);
  assert.throws(() => shoppingInput.parse({ ...input, variants: [] }));
  assert.throws(() => shoppingInput.parse({ ...input, variants: ['!!!'] }));
  assert.throws(() => shoppingInput.parse({ ...input, example_url: 'http://example.com/' }));
  assert.throws(() => shoppingInput.parse({ ...input, unexpected: true }));
  for (const url of ['https://127.0.0.1/', 'https://localhost/', 'https://host.local/', 'file:///tmp/test', 'https://[::1]/']) {
    assert.equal(isPublicShoppingURL(url), false);
  }
  const card = { title: 'MacBook Neo 256GB Indigo', text: 'In stock', price: '$699.99', url: 'https://www.target.com/p/-/A-91122045', seller: 'Target' };
  assert.equal(matchShoppingCards([{ ...card, text: 'Not in stock' }], input)[0].availability, 'reported-out-of-stock');
  assert.equal(matchShoppingCards([{ ...card, text: 'In stock\nOut of stock' }], input)[0].availability, 'unknown');
  assert.equal(matchShoppingCards([{ ...card, text: 'Free delivery tomorrow' }], input)[0].availability, 'unknown');
  assert.equal(matchShoppingCards([{ ...card, title: 'MacBook Neo 512GB Indigo' }], input)[0].match, 'uncertain');
  assert.equal(matchShoppingCards([{ ...card, text: 'Refurbished\nIn stock' }], input)[0].match, 'uncertain');
  assert.equal(matchShoppingCards([{ ...card, url: 'javascript:alert(1)' }], input).length, 0);

  const host = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  const prototype = Object.getPrototypeOf(host.webContents);
  const loadURL = prototype.loadURL;
  const getURL = prototype.getURL;
  const searches = new Set();
  let blocked = false;
  let navigationScenario;
  let interruptedLoads = 0;
  const db = new DesktopDatabase(':memory:');
  const shopping = new ShoppingService(db);
  try {
    await new LocalStore(db, randomUUID).initialize();
    await host.loadURL(`data:text/html,${encodeURIComponent(readFileSync(resolve(__dirname, 'shopping-fixture.html'), 'utf8'))}`);
    for (const platform of ['ios', 'android']) {
      const compiled = transformFileSync(resolve(__dirname, '../../shared/src/shopping.ts'), {
        babelrc: false, configFile: false, presets: [['babel-preset-expo', { platform }]],
        caller: { name: 'metro', platform, supportsStaticESM: false },
      });
      const exports = {};
      runInNewContext(compiled.code, { exports, require, URL });
      const cards = await host.webContents.executeJavaScript(`(${exports.extractShoppingCards.toString()})()`);
      assert.equal(matchShoppingCards(cards, input).length, 4, `${platform} native transpilation must still execute in the isolated page`);
    }
    prototype.loadURL = function (url, ...args) {
      if (!String(url).startsWith('https://www.google.com/search')) return loadURL.call(this, url, ...args);
      searches.add(this);
      assert.equal(this.getLastWebPreferences().sandbox, true);
      assert.equal(this.getLastWebPreferences().nodeIntegration, false);
      assert.equal(this.getLastWebPreferences().preload, undefined);
      if (navigationScenario) {
        this.session.protocol.handle('https', request => {
          const url = new URL(request.url);
          if (url.pathname === '/pending') {
            return new Promise(resolve => setTimeout(() => resolve(new Response(null, { status: 204 })), 500));
          }
          if (url.searchParams.has('reloaded')) {
            return new Response(readFileSync(resolve(__dirname, 'shopping-fixture.html'), 'utf8'),
              { status: navigationScenario === 'http-error' ? 429 : 200, headers: { 'content-type': 'text/html' } });
          }
          const destination = navigationScenario === 'blocked-redirect'
            ? 'https://www.google.com/sorry/index' : 'https://www.google.com/search?reloaded=1';
          return new Response(`<img src="/pending"><script>setTimeout(() => location.replace(${JSON.stringify(destination)}), 0)</script>`,
            { headers: { 'content-type': 'text/html' } });
        });
        return loadURL.call(this, url, ...args).catch(error => {
          if (error.code === 'ERR_ABORTED' || error.message.includes('ERR_ABORTED')) interruptedLoads++;
          throw error;
        });
      }
      if (blocked) return loadURL.call(this, 'data:text/html,<p>Our systems detected unusual traffic</p>');
      return loadURL.call(this, `data:text/html,${encodeURIComponent(readFileSync(resolve(__dirname, 'shopping-fixture.html'), 'utf8'))}`);
    };
    prototype.getURL = function () {
      return searches.has(this) ? 'https://www.google.com/search?q=fixture&udm=28' : getURL.call(this);
    };
    const pending = shopping.search(input);
    assert.throws(() => shopping.search(input), /already running/);
    const result = await pending;
    assert.equal(result.error, null);
    assert.equal(result.offers.length, 4);
    assert.equal(result.offers.filter(offer => offer.match === 'text-match').length, 2);
    assert.equal(result.offers[0].availability, 'reported-in-stock');
    assert.equal(result.offers[0].seller, 'Target');
    assert.ok(result.offers[0].details.includes('Free returns'));
    assert.equal(result.offers.find(offer => offer.seller === 'Walmart').availability, 'unknown');
    assert.equal((await shopping.history()).length, 1);
    const reopened = new ShoppingService(db);
    assert.equal((await reopened.history())[0].id, result.id);
    await reopened.close();
    assert.ok([...searches].every(contents => contents.isDestroyed()));
    blocked = true;
    const failure = await shopping.search(input);
    assert.match(failure.error, /verification/);
    assert.equal(failure.offers.length, 0);
    assert.equal((await shopping.history()).length, 2);
    navigationScenario = 'reload';
    const reloaded = await shopping.search(input);
    assert.equal(reloaded.error, null, 'an ordinary search-page reload must finish before extracting offers');
    assert.equal(reloaded.offers.length, 4);
    assert.ok(interruptedLoads > 0, 'the fixture must reproduce Electron ERR_ABORTED during script navigation');
    navigationScenario = 'http-error';
    const httpFailure = await shopping.search(input);
    assert.match(httpFailure.error, /HTTP 429/);
    assert.equal(httpFailure.offers.length, 0);
    navigationScenario = 'blocked-redirect';
    const redirected = await shopping.search(input);
    assert.match(redirected.error, /verification/);
    assert.equal(redirected.offers.length, 0);
    navigationScenario = undefined;
    for (let index = 0; index < 20; index++) {
      await db.run('INSERT INTO shopping_searches(id,checked_at,result) VALUES(?,?,?)',
        [`old-${index}`, '2000-01-01T00:00:00.000Z', JSON.stringify(result)]);
    }
    await shopping.search(input);
    assert.equal((await db.all('SELECT id FROM shopping_searches')).length, 20, 'searching must prune old outcomes');
    await shopping.clearHistory();
    assert.equal((await shopping.history()).length, 0);
    const countBeforeCancel = searches.size;
    const cancelled = shopping.search(input);
    await assert.rejects(shopping.clearHistory(), /finish before clearing/);
    shopping.cancel();
    assert.match((await cancelled).error, /cancelled/);
    assert.ok([...searches].every(contents => contents.isDestroyed()));
    const closing = shopping.search(input);
    await shopping.close();
    assert.match((await closing).error, /cancelled/);
    assert.ok(searches.size <= countBeforeCancel + 1, 'closing before initialization finishes must not open another browser');
    assert.throws(() => shopping.search(input), /closed/);
    console.log('Shopping smoke passed: isolated browser, rendered extraction, exact-text/uncertain matching, stock labels, blocked searches, local history and cleanup.');
  } finally {
    prototype.loadURL = loadURL;
    prototype.getURL = getURL;
    await shopping.close();
    await db.close();
    host.destroy();
  }
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
