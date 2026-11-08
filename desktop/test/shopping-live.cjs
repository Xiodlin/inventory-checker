const { app } = require('electron');
const { DesktopDatabase } = require('../dist/main/database');
const { LocalStore } = require('@inventory-checker/core');
const { ShoppingService } = require('../dist/main/shoppingService');
const { randomUUID } = require('node:crypto');
app.on('window-all-closed', () => {});
app.on('web-contents-created', (_event, contents) => {
  const location = value => {
    try { const url = new URL(value); return `${url.origin}${url.pathname}`; }
    catch { return 'unavailable'; }
  };
  for (const name of ['will-navigate', 'will-redirect', 'did-start-navigation', 'did-navigate']) {
    contents.on(name, (_event, url) => console.log(name, location(url)));
  }
  contents.on('did-fail-load', (_event, code, description, url, mainFrame) => {
    if (mainFrame) console.log('did-fail-load', code, description, location(url));
  });
  contents.on('dom-ready', () => console.log('dom-ready', location(contents.getURL())));
});
app.whenReady().then(async () => {
  const db = new DesktopDatabase(':memory:');
  const service = new ShoppingService(db);
  try {
    await new LocalStore(db, randomUUID).initialize();
    const result = await service.search({ product: 'MacBook Neo', variants: ['256GB', 'Indigo'] });
    console.log(JSON.stringify({ offers: result.offers, error: result.error }, null, 2));
  } finally { await service.close(); await db.close(); }
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
