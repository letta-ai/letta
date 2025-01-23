import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
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

contextBridge.exposeInMainWorld('lettaServer', {
  getLogs: () => ipcRenderer.invoke('letta-server:get-logs'),
  onGetLogs: (callback) => {
    return ipcRenderer.on('letta-server:receive-logs', (_event, value) => {
      return callback(value);
    });
  },
  restart: () => ipcRenderer.invoke('letta-server:restart'),
});

contextBridge.exposeInMainWorld('lettaConfig', {
  load: () => ipcRenderer.invoke('letta-config:load'),
  save: (config) => ipcRenderer.invoke('letta-config:save', config),
  onLoad: (callback) => {
    return ipcRenderer.on('letta-config:receive', (_event, value) => {
      return callback(value);
    });
  },
});
