import { BrowserWindow, shell, screen } from 'electron';
import { rendererAppName, rendererAppPort } from './constants';
import { environment } from '../environments/environment';
import { join } from 'path';
import { format } from 'url';

const fixPath = require('fix-path'); // This works with fix-path@3 (CJS)
import * as electron from 'electron';
import * as fs from 'fs';
import { execFile, execFileSync } from 'child_process';
import * as path from 'path';
import type { ServerLogType } from '@letta-cloud/types';
import * as os from 'os';
import { createWebServer, setServerId } from './web-server';
import { getDesktopConfig } from './utils/desktop-config/desktop-config';

// Store the logs in a desktop log file
const homeDir = os.homedir();
const logFilePath = path.join(homeDir, '.letta', 'desktop.log');

// 1) ensure directory exists
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// 2) wipe the old log on every launch
if (fs.existsSync(logFilePath)) {
  fs.writeFileSync(logFilePath, '');
}

let postgresProcess: ReturnType<typeof execFile> | null = null;
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
    // write it out
    fs.appendFileSync(
      logFilePath,
      `[${log.timestamp}] ${log.message.replace(/\n/g, ' ')}\n`,
    );

    // keep in-memory too
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

// Immediately patch console to write to logfile + in-memory buffer for visualization
(() => {
  const oLog = console.log,
    oErr = console.error;
  console.log = (...args: any[]) => {
    lettaServerLogs.addLog({
      type: 'info',
      message: args.join(' '),
      timestamp: new Date().toLocaleString(),
    });
    oLog(...args);
  };
  console.error = (...args: any[]) => {
    lettaServerLogs.addLog({
      type: 'error',
      message: args.join(' '),
      timestamp: new Date().toLocaleString(),
    });
    oErr(...args);
  };
})();

import * as todesktop from '@todesktop/runtime';
import {
  getIsEmbeddedPostgres,
  getIsLocalServer,
} from './utils/getIsEmbeddedPostgres/getIsEmbeddedPostgres';
import { getIsSQLLiteConfig } from './utils/getIsSQLLiteConfig/getIsSQLLiteConfig';

todesktop.init();

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
  let fileName;
  if (process.platform === 'win32') {
    fileName = 'letta.exe';
  } else if (process.platform === 'linux') {
    fileName = 'letta.elf';
  } else {
    fileName = 'letta';  // macOS
  }

  let lettaServerPath = path.join(
    __dirname,
    '..',
    '..',
    'desktop-core',
    'dist',
    fileName,
  );

  if (App.application.isPackaged) {
    // First try the unpacked location (for asar unpacked files)
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', fileName);
    if (fs.existsSync(unpackedPath)) {
      lettaServerPath = unpackedPath;
    } else {
      // Fallback to the regular location
      lettaServerPath = path.join(__dirname, '..', 'dist', fileName);
    }
  }

  const lettaPath = path.join(homeDir || '/', '.letta', 'bin');

  if (!fs.existsSync(lettaPath)) {
    fs.mkdirSync(lettaPath, { recursive: true });
  }

  // Check if source file exists before copying
  if (!fs.existsSync(lettaServerPath)) {
    console.error(`Letta binary not found at: ${lettaServerPath}`);
    console.error(`Current directory: ${__dirname}`);
    console.error(`Process resourcesPath: ${process.resourcesPath}`);
    console.error(`Is packaged: ${App.application.isPackaged}`);
    throw new Error(`Letta binary not found at: ${lettaServerPath}`);
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

  static async restartLettaServer() {
    await App.stopLettaServer();

    setTimeout(() => {
      App.startLettaServer(false);
    }, 1000);
  }

  static async stopLettaServer() {
    if (lettaServer) {
      lettaServerLogs.clearLogs();

      console.log('Stopping Letta server...');

      lettaServer.kill();

      setServerId(null);
      await App.killLettaServer();
    }
  }

  static findLettaDesktopConfig() {}

  static startLettaServer(copyFiles: boolean = true) {
    const config = getDesktopConfig();

    // lettaServerLogs.clearLogs();

    if (!config) {
      console.log('No desktop config found. Please set one up...');

      return;
    }

    if (getIsLocalServer(config)) {
      return;
    }

    // Copy alembic files for both embedded Postgres and SQLite
    if (getIsEmbeddedPostgres(config) || getIsSQLLiteConfig(config)) {
      if (copyFiles) {
        copyAlembicToLettaDir();
      }
    }

    copyLettaServerToLettaDir();

    console.log('Starting Letta Server...');

    let binaryName;
    if (process.platform === 'win32') {
      binaryName = 'letta.exe';
    } else if (process.platform === 'linux') {
      binaryName = 'letta.elf';
    } else {
      binaryName = 'letta';  // macOS
    }

    let lettaServerPath = path.join(homeDir || '/', '.letta', 'bin', binaryName);
    lettaServer = null;
    const serverId = Math.random().toString(36).substring(7);
    setServerId(serverId);
    lettaServer = execFile(
      lettaServerPath,
      [
        ...(getIsSQLLiteConfig(config) ? [] : ['--use-file-pg-uri']),
        `--look-for-server-id=${serverId}`,
        '--no-generation',
      ],
      {
        env: {
          // Keep the user's existing environment, but override to ensure UTF-8
          ...process.env,
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
          LANGUAGE: 'en_US:en',
        },
      },
    );

    if (lettaServer.stdout) {
      lettaServer.stdout.on('data', (data) => {
        if (data.toString().includes('/v1/health')) {
          return;
        }

        console.log(data.toString());
      });
    }

    if (lettaServer.stderr) {
      lettaServer.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
      });
    }

    lettaServer.on('close', (code) => {
      console.error(`child process exited with code ${code}`);
    });
  }

  static async lettaStartupRouting() {
    App.mainWindow.webContents.send('set-path', '/dashboard/agents');
  }

  static async killLettaServer() {
    if (lettaServer) {
      lettaServer.kill();
      lettaServer = null;
    }

    await App.stopPostgres();
  }

  // NOTE: hardcoding for local dev testing
  // If using postgres17:
  //const postgresBinPath = '/opt/homebrew/opt/postgresql@17/bin/postgres';
  //const initdbPath = '/opt/homebrew/opt/postgresql@17/bin/initdb';
  // If using postgres16:
  // NOTE: embedded pgserver was postgres16, so this matches better (no migration needed)
  // const postgresBinPath = '/opt/homebrew/opt/postgresql@16/bin/postgres';
  // const initdbPath = '/opt/homebrew/opt/postgresql@16/bin/initdb';
  static async startPostgres() {
    console.log(`[postgres] Platform: ${process.platform}`);

    // Determine which PostgreSQL directory to use based on platform
    const postgresDir =
      process.platform === 'win32' ? 'postgres-16-windows-x64' : 'postgres-16';
    const exeExt = process.platform === 'win32' ? '.exe' : '';
    const pgPort = process.platform === 'win32' ? '54321' : '5433'; // Use higher port on Windows

    let basePath;
    if (!App.application.isPackaged) {
      // In development, use our custom resources folder.
      basePath = path.join(__dirname, '..', 'resources');
    } else {
      // In packaged mode, assume our custom resources were unpacked into app.asar.unpacked/resources.
      const unpacked = path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'resources',
      );
      if (fs.existsSync(unpacked)) {
        basePath = unpacked;
      } else {
        basePath = process.resourcesPath || __dirname;
      }
      // Copy the postgres-16 folder from the unpacked resources to an external location
      const targetBinDir = path.join(
        os.homedir(),
        '.letta',
        'desktop_bin',
        postgresDir,
      );
      if (fs.existsSync(targetBinDir)) {
        console.log(
          `[postgres] Removing existing desktop_bin at ${targetBinDir}`,
        );
        fs.rmSync(targetBinDir, { recursive: true, force: true });
      }
      console.log(
        `[postgres] Copying postgres binaries from ${join(basePath, postgresDir)} to ${targetBinDir}`,
      );
      fs.cpSync(join(basePath, postgresDir), targetBinDir, {
        recursive: true,
      });
      // Update basePath so that binaries are run from the external location.
      basePath = path.join(os.homedir(), '.letta', 'desktop_bin');
    }

    const postgresBinPath = join(
      basePath,
      postgresDir,
      'bin',
      `postgres${exeExt}`,
    );
    const initdbPath = join(basePath, postgresDir, 'bin', `initdb${exeExt}`);
    const dataDir = path.join(os.homedir(), '.letta', 'desktop_data');

    console.log(`[postgres] process.resourcesPath: ${process.resourcesPath}`);
    console.log(`[postgres] __dirname: ${__dirname}`);
    console.log(`[postgres] Base path: ${basePath}`);
    console.log(
      `[postgres] Contents of base path:`,
      fs.existsSync(basePath) ? fs.readdirSync(basePath) : 'not found',
    );
    console.log(`[postgres] BIN path: ${postgresBinPath}`);
    console.log(`[postgres] INITDB path: ${initdbPath}`);
    console.log(`[postgres] DATA dir: ${dataDir}`);
    console.log(`[postgres] Environment PATH: ${process.env.PATH}`);

    if (!fs.existsSync(postgresBinPath)) {
      console.error(
        `[postgres] ERROR: postgres binary not found at ${postgresBinPath}`,
      );
    }
    if (!fs.existsSync(initdbPath)) {
      console.error(
        `[postgres] ERROR: initdb binary not found at ${initdbPath}`,
      );
    }

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
        console.log('[postgres] Running initdb...');
        try {
          execFileSync(initdbPath, [
            '-D',
            dataDir,
            '-U',
            'postgres',
            '--locale=en_US.UTF-8',
            '--encoding=UTF8',
          ]);
        } catch (err) {
          console.error('[postgres] initdb error:', err);
          throw err;
        }
      }

      // Platform-specific environment setup
      let spawnEnv;

      if (process.platform === 'win32') {
        // Windows environment setup - add lib directory to PATH
        const libPath = join(
          os.homedir(),
          '.letta',
          'desktop_bin',
          postgresDir,
          'lib',
        );
        spawnEnv = {
          PATH: `${libPath};${process.env.PATH || ''}`,
          HOME: process.env.HOME || os.homedir(),
          LC_ALL: 'en_US.UTF-8',
        };
      } else {
        // macOS environment setup - set DYLD_LIBRARY_PATH
        const libPath = join(
          os.homedir(),
          '.letta',
          'desktop_bin',
          postgresDir,
          'lib',
        );

        spawnEnv = {
          PATH: '/usr/local/bin:/usr/bin:/bin',
          DYLD_LIBRARY_PATH: libPath,
          HOME: process.env.HOME || os.homedir(),
          LC_ALL: 'en_US.UTF-8',
        };
      }

      // Prepare a robust spawn environment.
      // A minimal spawn environment tested on MacOS
      // NOTE: on MacOS 14.4, everything actually works even just with only { LC_ALL: ... }
      // const spawnEnv = {
      //   PATH: '/usr/local/bin:/usr/bin:/bin',
      //   DYLD_LIBRARY_PATH: join(os.homedir(), '.letta', 'desktop_bin', 'postgres-16', 'lib'),
      //   HOME: process.env.HOME || os.homedir(),
      //   LC_ALL: 'en_US.UTF-8'
      // };
      // A more generous spawn environment
      // const spawnEnv = Object.assign({}, process.env, {
      //   PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      //   DYLD_LIBRARY_PATH:
      //     process.env.DYLD_LIBRARY_PATH ||
      //     join(os.homedir(), '.letta', 'desktop_bin', 'postgres-16', 'lib'),
      //   HOME: process.env.HOME || os.homedir(),
      //   LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
      // });
      console.log(`[postgres] Using spawn environment:`, spawnEnv);

      // Launch the Postgres process with the explicit environment.
      postgresProcess = execFile(
        postgresBinPath,
        // ['-D', dataDir, '-p', pgPort],
        [
          '-D',
          dataDir,
          '-p',
          pgPort,
          '-c',
          'timezone=UTC',
          '-c',
          'client_encoding=UTF8',
        ],
        { env: spawnEnv },
      );

      postgresProcess.stdout?.on('data', (data) => {
        console.log(`[postgres] ${data}`);
      });

      postgresProcess.stderr?.on('data', (data) => {
        // Using log instead of error since Postgres will dump messages to stderr that aren't errors:
        // e.g.: 'LOG: starting PostgreSQL 16.8 on x86_64-apple-darwin23.6.0, compiled by ...'
        console.log(`[postgres stderr] ${data}`);
      });

      postgresProcess.on('close', (code) => {
        console.log(`Postgres exited with code ${code}`);
      });

      const uriPath = join(os.homedir(), '.letta', 'pg_uri');
      const uri = `postgresql+pg8000://postgres@localhost:${pgPort}/postgres`;
      fs.writeFileSync(uriPath, uri);

      // Write the PID to a file (e.g., ~/.letta/postgres_pid)
      // This is so that we can close it via the Python server
      const pidFile = path.join(os.homedir(), '.letta', 'postgres_pid');
      fs.writeFileSync(pidFile, String(postgresProcess.pid));
    } catch (err) {
      console.error('Failed to start Postgres:', err);
      throw err;
    }
  }

  private static async waitForPostgresReady(timeoutMs = 20000): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!postgresProcess) {
        return reject(new Error('No Postgres process to wait on.'));
      }

      // Example: 'LOG:  database system is ready to accept connections'
      // const readyRegex = /pineapple to accept connections/i;
      const readyRegex = /ready to accept connections/i;
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          reject(
            new Error(
              `Postgres did not report readiness within ${timeoutMs}ms.`,
            ),
          );
        }
      }, timeoutMs);

      const onData = (data: Buffer) => {
        const text = data.toString();
        console.log(`[postgres] ${text}`);
        if (readyRegex.test(text)) {
          // Found the magic "ready to accept connections" line
          clearTimeout(timer);
          resolved = true;
          resolve();
        }
      };

      // Postgres often logs to stderr, so watch both
      postgresProcess.stdout?.on('data', onData);
      postgresProcess.stderr?.on('data', onData);

      // If Postgres exits before we see "ready", fail
      postgresProcess.on('close', (code) => {
        if (!resolved) {
          clearTimeout(timer);
          reject(new Error(`Postgres closed prematurely with code ${code}`));
        }
      });
    });
  }

  static async stopPostgres() {
    if (postgresProcess) {
      postgresProcess.kill();
      postgresProcess = null;
    }
  }

  private static async onReady() {
    // Intercept logs first so that everything after is captured
    // interceptMainProcessLogs();

    // Log PATH before fix-path
    console.log('[fp] PATH pre-patch:', process.env.PATH);
    // ensures PATH matches user’s login shell (on macOS/Linux)
    fixPath();
    // Log PATH after fix-path
    console.log('[fp] PATH post-patch:', process.env.PATH);

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    try {
      if (rendererAppName) {
        await App.killLettaServer();

        App.initMainWindow();
        App.loadMainWindow();

        App.mainWindow.once('ready-to-show', async () => {
          App.mainWindow.show(); // shows the window

          App.lettaStartupRouting();

          // only start embedded PG if they explicitly opted in
          const desktopConfig = getDesktopConfig();
          if (
            !process.env.IGNORE_POSTGRES &&
            desktopConfig &&
            getIsEmbeddedPostgres(desktopConfig)
          ) {
            try {
              await App.startPostgres();
              await App.waitForPostgresReady();
            } catch (err) {
              console.error('[postgres] Failed to start:', err);
            }
          } else {
            if (desktopConfig?.databaseConfig.type === 'external') {
              console.log(
                '[postgres] Detected external database config type, skipping embedded PG bootup',
              );
            }
          }

          App.startLettaServer();
          createWebServer();
        });
      }
    } catch (err) {
      console.error(
        'An error occured while trying to start Letta Desktop:',
        err,
      );
      console.error(
        'Please check your logs (~/.letta/desktop.log) or contact Letta support via Discord.',
      );
      // electron.dialog.showErrorBox(
      //   'Error',
      //   `An error occured while trying to start Letta Desktop (${err}). ` +
      //     'Please check your logs (~/.letta/desktop.log) or contact Letta support via Discord.',
      // );
      // App.application.quit();
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
    electron.app.once('before-quit', async () => {
      await App.killLettaServer();
    });
    App.application.on('window-all-closed', App.onWindowAllClosed); // Quit when all windows are closed.
    App.application.on('ready', App.onReady); // App is ready to load data
    App.application.on('activate', App.onActivate); // App is activated
  }
}
