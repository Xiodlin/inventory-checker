import { BrowserWindow, ipcMain, Notification } from 'electron';

export function registerIpcHandlers(getWindow: () => BrowserWindow | null, rendererUrl: string): void {
  ipcMain.handle('inventory:notify', (event, payload: unknown) => {
    const window = getWindow();
    if (!window || event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame.url !== rendererUrl) {
      throw new Error('Untrusted notification sender');
    }
    if (!payload || typeof payload !== 'object') throw new Error('Invalid notification');
    const { title, body } = payload as { title?: unknown; body?: unknown };
    if (typeof title !== 'string' || typeof body !== 'string' ||
        title.trim().length === 0 || title.length > 120 || body.length > 1000) {
      throw new Error('Invalid notification text');
    }
    if (!Notification.isSupported()) return false;
    const notification = new Notification({ title, body });
    notification.on('click', () => {
      window.show();
      window.focus();
    });
    notification.show();
    return true;
  });
}
