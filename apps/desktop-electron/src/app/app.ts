import { BrowserWindow, shell, screen } from 'electron';
import { rendererAppName, rendererAppPort } from './constants';
import { environment } from '../environments/environment';
import { join } from 'path';
import { format } from 'url';
import * as electron from 'electron';
import * as fs from 'fs';
import { execFile } from 'child_process';
import * as path from 'path';
import type { ServerLogType } from '@letta-cloud/types';
import * as todesktop from '@todesktop/runtime';
import * as os from 'os';
todesktop.init();

let lettaServer: ReturnType<typeof execFile> | null = null;

class ServerLogs {
  logs: ServerLogType[] = [];
  limit: number = 1000;

  constructor() {
    this.logs = [];
  }

  clearLogs() {
    this.logs = [];
  }

  addLog(log: ServerLogType) {
    this.logs.push(log);
    if (this.logs.length > this.limit) {
      this.logs.shift();
    }
  }

  getLogs() {
    return this.logs;
  }
}

const lettaServerLogs = new ServerLogs();
const homeDir = os.homedir();

function copyAlembicToLettaDir() {
  let alembicFolderPath = path.join(__dirname, '..', '..', 'core', 'alembic');
  let alembicInitPath = path.join(__dirname, '..', '..', 'core', 'alembic.ini');

  if (App.application.isPackaged) {
    alembicFolderPath = path.join(__dirname, '..', 'dist', 'alembic');
    alembicInitPath = path.join(__dirname, '..', 'dist', 'alembic.ini');
  }

  const migrationsPath = path.join(homeDir || '/', '.letta', 'migrations');

  if (!fs.existsSync(migrationsPath)) {
    fs.mkdirSync(migrationsPath, { recursive: true });
  }

  fs.copyFileSync(alembicInitPath, path.join(migrationsPath, 'alembic.ini'));

  if (!fs.existsSync(migrationsPath)) {
    fs.mkdirSync(path.join(migrationsPath), { recursive: true });
  }

  if (!fs.existsSync(path.join(migrationsPath, 'alembic'))) {
    fs.mkdirSync(path.join(migrationsPath, 'alembic'), { recursive: true });
  }

  if (!fs.existsSync(path.join(migrationsPath, 'alembic', 'versions'))) {
    fs.mkdirSync(path.join(migrationsPath, 'alembic', 'versions'), {
      recursive: true,
    });
  }

  fs.copyFileSync(
    path.join(alembicFolderPath, 'env.py'),
    path.join(migrationsPath, 'alembic', 'env.py'),
  );

  const alembicFiles = fs.readdirSync(path.join(alembicFolderPath, 'versions'));
  for (const file of alembicFiles) {
    if (file.endsWith('.py')) {
      fs.copyFileSync(
        path.join(alembicFolderPath, 'versions', file),
        path.join(migrationsPath, 'alembic', 'versions', file),
      );
    }
  }

  console.log('Alembic files copied to Letta directory');
}

function copyLettaServerToLettaDir() {
  let fileName = process.platform === 'win32' ? 'letta.exe' : 'letta';

  let lettaServerPath = path.join(
    __dirname,
    '..',
    '..',
    'desktop-core',
    'dist',
    fileName,
  );

  if (App.application.isPackaged) {
    lettaServerPath = path.join(__dirname, '..', 'dist', fileName);
  }

  const lettaPath = path.join(homeDir || '/', '.letta', 'bin');

  if (!fs.existsSync(lettaPath)) {
    fs.mkdirSync(lettaPath, { recursive: true });
  }

  fs.copyFileSync(lettaServerPath, path.join(lettaPath, fileName));

  // chmod +x
  fs.chmodSync(path.join(lettaPath, fileName), parseInt('755', 8));
}

export default class App {
  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  static mainWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static BrowserWindow;

  public static isDevelopmentMode() {
    const isEnvironmentSet: boolean = 'ELECTRON_IS_DEV' in process.env;
    const getFromEnvironment: boolean =
      parseInt(process.env.ELECTRON_IS_DEV || '', 10) === 1;

    return isEnvironmentSet ? getFromEnvironment : !environment.production;
  }

  private static onWindowAllClosed() {
    if (process.platform !== 'darwin') {
      App.application.quit();
    }
  }

  private static onClose() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    // @ts-ignore
    App.mainWindow = null;
  }

  private static onRedirect(event: any, url: string) {
    if (url !== App.mainWindow.webContents.getURL()) {
      // this is a normal external redirect, open it in a new browser window
      event.preventDefault();
      shell.openExternal(url);
    }
  }

  static getLettaServerLogs() {
    return lettaServerLogs.getLogs();
  }

  static loadLettaConfig() {
    const configPath = path.join(homeDir || '/', '.letta', 'env');

    if (!fs.existsSync(configPath)) {
      // create the file
      fs.writeFileSync(configPath, '');
    }

    return fs.readFileSync(configPath, 'utf-8');
  }

  static saveLettaConfig(config: string) {
    const configPath = path.join(homeDir || '/', '.letta', 'env');

    fs.writeFileSync(configPath, config);

    App.restartLettaServer();
  }

  static restartLettaServer() {
    App.stopLettaServer();

    setTimeout(() => {
      App.startLettaServer(false);
    }, 1000);
  }

  static stopLettaServer() {
    if (lettaServer) {
      lettaServerLogs.clearLogs();

      lettaServerLogs.addLog({
        type: 'info',
        message: 'Stopping letta server...',
        timestamp: new Date().toISOString(),
      });

      lettaServer.kill();
    }
  }

  static startLettaServer(copyFiles: boolean = true) {
    if (copyFiles) {
      copyAlembicToLettaDir();
      copyLettaServerToLettaDir();
    }

    lettaServerLogs.clearLogs();

    lettaServerLogs.addLog({
      type: 'info',
      message: 'Starting Letta server...',
      timestamp: new Date().toISOString(),
    });

    let lettaServerPath = path.join(homeDir || '/', '.letta', 'bin', 'letta');
    lettaServer = null;
    lettaServer = execFile(lettaServerPath, ['--use-file-pg-uri']);

    if (lettaServer.stdout) {
      lettaServer.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);

        lettaServerLogs.addLog({
          type: 'info',
          message: data.toString(),
          timestamp: new Date().toISOString(),
        });
      });
    }

    if (lettaServer.stderr) {
      lettaServer.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);

        lettaServerLogs.addLog({
          type: 'error',
          message: data.toString(),
          timestamp: new Date().toISOString(),
        });
      });
    }

    lettaServer.on('close', (code) => {
      console.log(`child process exited with code ${code}`);

      lettaServerLogs.addLog({
        type: 'info',
        message: `child process exited with code ${code}`,
        timestamp: new Date().toISOString(),
      });
    });
  }

  static async lettaStartupRouting() {
    App.mainWindow.webContents.send('set-path', '/dashboard/agents');
  }

  private static onReady() {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    if (rendererAppName) {
      App.startLettaServer();

      App.initMainWindow();
      App.loadMainWindow();
      App.mainWindow.webContents.on('did-finish-load', function () {
        App.lettaStartupRouting();
      });
    }
  }

  private static onActivate() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (App.mainWindow === null) {
      App.onReady();
    }
  }

  private static initMainWindow() {
    const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
    const width = Math.min(350, workAreaSize.width || 350);
    const height = Math.min(475, workAreaSize.height || 475);
    const app = electron.app;

    const lock = app.requestSingleInstanceLock();

    if (!lock) {
      app.quit();
      return;
    }

    app.on('second-instance', () => {
      // Someone tried to run a second instance, we should focus our window.
      if (App.mainWindow) {
        if (App.mainWindow.isMinimized()) App.mainWindow.restore();
        App.mainWindow.focus();
      }
    });

    // Create the browser window.
    App.mainWindow = new BrowserWindow({
      width: width,
      height: height,
      show: false,
      frame: false,
      transparent: true,
      trafficLightPosition: { x: 15, y: 12 },
      icon: electron.nativeImage.createFromPath(
        app.getAppPath() + '/assets/icon.png',
      ),
      titleBarStyle: 'hidden',
      ...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {}),
      webPreferences: {
        contextIsolation: true,
        backgroundThrottling: false,
        preload: join(__dirname, 'main.preload.js'),
      },
    });

    App.mainWindow.webContents.setWindowOpenHandler((edata) => {
      shell.openExternal(edata.url);

      return { action: 'deny' };
    });

    const image = electron.nativeImage.createFromPath(
      app.getAppPath() + '/assets/icon.png',
    );

    // check if app is macOS
    if (process.platform === 'darwin') {
      // set the icon of the app
      app.dock.setIcon(image);
    }

    App.mainWindow.setMenu(null);
    App.mainWindow.center();

    // if main window is ready to show, close the splash window and show the main window
    App.mainWindow.once('ready-to-show', () => {
      App.mainWindow.show();
    });

    // handle all external redirects in a new browser window
    // App.mainWindow.webContents.on('will-navigate', App.onRedirect);
    // App.mainWindow.webContents.on('new-window', (event, url, frameName, disposition, options) => {
    //     App.onRedirect(event, url);
    // });

    // Emitted when the window is closed.
    App.mainWindow.on('closed', () => {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.

      App.stopLettaServer();

      // @ts-ignore
      App.mainWindow = null;
    });
  }

  private static loadMainWindow() {
    // load the index.html of the app.
    if (!App.application.isPackaged) {
      App.mainWindow.loadURL(`http://localhost:${rendererAppPort}`);
      App.mainWindow.webContents.openDevTools();
    } else {
      App.mainWindow.loadURL(
        format({
          pathname: join(__dirname, '..', 'dist', 'index.html'),
          protocol: 'file:',
          slashes: true,
        }),
      );

      if (process.argv.includes('--debug')) {
        App.mainWindow.webContents.openDevTools();
        console.log('debugging');
      }
    }
  }

  static main(app: Electron.App, browserWindow: typeof BrowserWindow) {
    // we pass the Electron.App object and the
    // Electron.BrowserWindow into this function
    // so this class has no dependencies. This
    // makes the code easier to write tests for

    App.BrowserWindow = browserWindow;
    App.application = app;

    electron.app.once('window-all-closed', electron.app.quit);
    electron.app.once('before-quit', () => {
      if (lettaServer) {
        lettaServer.kill();
      }
    });
    App.application.on('window-all-closed', App.onWindowAllClosed); // Quit when all windows are closed.
    App.application.on('ready', App.onReady); // App is ready to load data
    App.application.on('activate', App.onActivate); // App is activated
  }
}
