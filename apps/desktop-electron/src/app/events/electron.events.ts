/**
 * This module is responsible on handling all the inter process communications
 * between the frontend to the electron backend.
 */

import { app, ipcMain } from 'electron';
import { environment } from '../../environments/environment';
import App from '../app';
import {
  getDesktopConfig,
  saveDesktopConfig,
} from '../utils/desktop-config/desktop-config';
import type { DesktopConfigSchemaType } from '@letta-cloud/types';

export default class ElectronEvents {
  static bootstrapElectronEvents(): Electron.IpcMain {
    return ipcMain;
  }
}

// Retrieve app version
ipcMain.handle('get-app-version', (_event) => {
  console.log(`Fetching application version... [v${environment.version}]`);

  return environment.version;
});

ipcMain.handle('letta-config:load', () => {
  const config = App.loadLettaConfig();

  App.mainWindow.webContents.send('letta-config:receive', config);
});

ipcMain.handle('letta-config:save', (_event, config) => {
  App.saveLettaConfig(config);
});

ipcMain.handle('letta-server:get-logs', () => {
  const logs = App.getLettaServerLogs();

  App.mainWindow.webContents.send('letta-server:receive-logs', logs);
});

ipcMain.handle('desktop-config:get', () => {
  const config = getDesktopConfig();

  App.mainWindow.webContents.send('desktop-config:receive', config);
});

ipcMain.handle(
  'desktop-config:save',
  (_event, payload: DesktopConfigSchemaType) => {
    saveDesktopConfig(payload);

    App.restartLettaServer();
  },
);

ipcMain.handle('letta-server:restart', () => {
  App.restartLettaServer();
});

ipcMain.handle('set-to-dashboard-size', () => {
  App.mainWindow.setSize(1200, 800);
  // center
  App.mainWindow.center();
});

// Handle App termination
ipcMain.on('quit', (_event, code) => {
  app.exit(code);
});
