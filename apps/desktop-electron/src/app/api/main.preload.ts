import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  installLetta: () => ipcRenderer.invoke('install-letta'),
  setToDashboardSize: () => ipcRenderer.invoke('set-to-dashboard-size'),
});

contextBridge.exposeInMainWorld('darkMode', {
  toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
  system: () => ipcRenderer.invoke('dark-mode:system'),
});

contextBridge.exposeInMainWorld('router', {
  onUpdateRoute: (callback) => {
    return ipcRenderer.on('set-path', (_event, value) => {
      return callback(value);
    });
  },
});
