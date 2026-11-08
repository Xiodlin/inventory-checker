import { app, BrowserWindow, dialog, Menu, nativeImage, powerMonitor, Tray } from 'electron';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerIpcHandlers } from './ipcHandlers';
import { DesktopService } from './localService';

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let service: DesktopService | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
app.setName('Inventory Checker');
const rendererPath = join(__dirname, '../renderer/public/index.html');
const rendererUrl = pathToFileURL(rendererPath).href;

function restore(): void {
  window?.show();
  if (window?.isMinimized()) window.restore();
  window?.focus();
}
function check(): void {
  void service?.checkDue().catch(error => {
    console.error('Local monitoring failed:', error instanceof Error ? error.message : 'Unknown error');
    window?.webContents.send('inventory:changed');
  });
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1180, height: 820, minWidth: 900, minHeight: 650,
    title: 'Inventory Checker', backgroundColor: '#101827',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-redirect', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.on('close', event => {
    if (!quitting && tray) {
      event.preventDefault();
      window?.hide();
    }
  });
  window.on('closed', () => { window = null; });
  void window.loadFile(rendererPath);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', restore);
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    clearInterval(timer);
    void (async () => { await service?.close(); app.quit(); })().catch(error => {
      dialog.showErrorBox('Could not close local storage', error instanceof Error ? error.message : 'Unknown error');
      app.exit(1);
    });
  });
  app.on('window-all-closed', () => app.quit());
  app.on('activate', () => { if (!window) createWindow(); else restore(); });
  void app.whenReady().then(async () => {
    app.setAppUserModelId('com.inventorychecker.desktop');
    app.on('web-contents-created', (_event, contents) => {
      contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
      contents.session.setPermissionCheckHandler(() => false);
    });
    await mkdir(app.getPath('userData'), { recursive: true });
    service = new DesktopService(app.getPath('userData'), () => window?.webContents.send('inventory:changed'), restore);
    await service.store.initialize();
    registerIpcHandlers(() => window, rendererUrl, service);
    createWindow();
    // A generated bitmap avoids a missing external icon in packaged builds.
    const pixels = Buffer.alloc(16 * 16 * 4);
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index] = 220; pixels[index + 1] = 170;
      pixels[index + 2] = 60; pixels[index + 3] = 255;
    }
    tray = new Tray(nativeImage.createFromBitmap(pixels, { width: 16, height: 16 }));
    tray.setToolTip('Inventory Checker');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Inventory Checker', click: restore },
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() },
    ]));
    tray.on('click', restore);
    timer = setInterval(check, 60000);
    powerMonitor.on('suspend', () => { clearInterval(timer); service?.cancelChecks(); });
    powerMonitor.on('resume', () => { clearInterval(timer); timer = setInterval(check, 60000); check(); });
    check();
  }).catch(error => {
    dialog.showErrorBox('Inventory Checker could not start', error instanceof Error ? error.message : 'Unknown error');
    app.quit();
  });
  app.on('will-quit', () => { tray?.destroy(); tray = null; });
}
