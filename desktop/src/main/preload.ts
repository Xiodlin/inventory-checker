import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('inventoryDesktop', Object.freeze({
  notify: (title: string, body: string): Promise<boolean> =>
    ipcRenderer.invoke('inventory:notify', { title, body }),
}));
