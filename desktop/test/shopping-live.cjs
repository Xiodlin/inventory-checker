const { app } = require('electron');
const { DesktopDatabase } = require('../dist/main/database');
const { LocalStore } = require('@inventory-checker/core');
const { ShoppingService } = require('../dist/main/shoppingService');
const { randomUUID } = require('node:crypto');
app.on('window-all-closed', () => {});
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
