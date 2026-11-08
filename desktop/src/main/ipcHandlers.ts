import { BrowserWindow, dialog, ipcMain } from 'electron';
import { readFile, stat, writeFile } from 'node:fs/promises';
import type { DesktopService } from './localService';

export function registerIpcHandlers(getWindow: () => BrowserWindow | null, rendererUrl: string, service: DesktopService): void {
  ipcMain.handle('inventory:local', async (event, operation: unknown, payload: unknown) => {
    const window = getWindow();
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame
        || event.senderFrame.url !== rendererUrl) throw new Error('Untrusted local-data sender');
    switch (operation) {
      case 'items': return service.store.items();
      case 'item': if (typeof payload === 'string') return service.store.item(payload); break;
      case 'prices': if (typeof payload === 'string') return service.store.prices(payload); break;
      case 'add': return service.store.addItem(payload);
      case 'delete': if (typeof payload === 'string') return service.store.deleteItem(payload); break;
      case 'notifications': return service.store.notifications();
      case 'read': if (typeof payload === 'string') return service.store.markRead(payload); break;
      case 'settings': return service.store.settings();
      case 'save-settings': return service.store.saveSettings(payload);
      case 'status': return service.store.status();
      case 'check': return service.monitor.checkNow();
      case 'check-due': return service.checkDue();
      case 'save-key': return service.saveKey(payload);
      case 'has-key': return Boolean(await service.getKey());
      case 'test-notification': return service.testNotification();
      case 'shopping-search': return service.shopping.search(payload);
      case 'shopping-history': return service.shopping.history();
      case 'shopping-clear': return service.shopping.clearHistory();
      case 'shopping-watches': return service.shoppingMonitor.watches();
      case 'shopping-save-watch': return service.shoppingMonitor.save(payload);
      case 'shopping-remove-watch': if (typeof payload === 'string') return service.shoppingMonitor.remove(payload); break;
      case 'export': {
        const selected = await dialog.showSaveDialog(window, { defaultPath: 'inventory-backup.json', filters: [{ name: 'JSON backup', extensions: ['json'] }] });
        if (selected.canceled || !selected.filePath) return false;
        await writeFile(selected.filePath, await service.store.exportBackup(), { mode: 0o600 });
        return true;
      }
      case 'import': {
        const selected = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'JSON backup', extensions: ['json'] }] });
        if (selected.canceled) return false;
        const path = selected.filePaths[0];
        if ((await stat(path)).size > 16 * 1024 * 1024) throw new Error('Backup exceeds the 16 MB limit');
        await service.store.importBackup(await readFile(path, 'utf8'));
        window.webContents.send('inventory:changed');
        return true;
      }
    }
    throw new Error('Invalid local-data operation');
  });
}
