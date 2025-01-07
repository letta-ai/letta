/**
 * This module is responsible on handling all the inter process communications
 * between the frontend to the electron backend.
 */

import { app, ipcMain } from 'electron';
import { environment } from '../../environments/environment';
import * as path from 'path';
import * as fs from 'fs';
import App from '../app';
import * as os from 'os';
import * as sudo from 'sudo-prompt';

export default class ElectronEvents {
  static bootstrapElectronEvents(): Electron.IpcMain {
    return ipcMain;
  }
}

// Retrieve app version
ipcMain.handle('get-app-version', (event) => {
  console.log(`Fetching application version... [v${environment.version}]`);

  return environment.version;
});

function copyAlembicToLettaDir() {
  let alembicFolderPath = path.join(
    __dirname,
    '..',
    'desktop-electron',
    'assets',
    'alembic',
  );
  let alembicInitPath = path.join(
    __dirname,
    '..',
    'desktop-electron',
    'assets',
    'alembic.ini',
  );

  if (App.application.isPackaged) {
    alembicFolderPath = path.join(
      __dirname,
      '..',
      'desktop-electron',
      'assets',
      'alembic',
    );
    alembicInitPath = path.join(
      __dirname,
      '..',
      'desktop-electron',
      'assets',
      'alembic.ini',
    );
  }

  const migrationsPath = path.join(
    process.env.HOME || '/',
    '.letta',
    'migrations',
  );

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

const isMac = os.platform() === 'darwin';
const isLinux = os.platform() === 'linux';

async function copyLettaToBin() {
  if (!fs.existsSync(path.join(process.env.HOME || '/', '.letta'))) {
    fs.mkdirSync(path.join(process.env.HOME || '/', '.letta'), {
      recursive: true,
    });
  }

  copyAlembicToLettaDir();
  let lettaCorePath = path.join(app.getAppPath() + '/assets/letta');

  if (App.application.isPackaged) {
    lettaCorePath = path.join(
      __dirname,
      '..',
      'desktop-electron',
      'assets',
      'letta',
    );
  }

  if (!fs.existsSync(lettaCorePath)) {
    console.error('Letta Core is missing, generate via `just prepare-desktop');
    return;
  }

  fs.access(lettaCorePath, fs.constants.X_OK, (err) => {
    if (err) {
      console.error(
        'Letta Core is not executable, run `chmod +x assets/letta`',
      );
      return;
    }
  });

  if (isMac || isLinux) {
    await new Promise((resolve, reject) => {
      // move letta to ~/.letta/tmp
      // check if tmp exists
      const tmpPath = path.join(process.env.HOME || '/', '.letta', 'tmp');

      if (!fs.existsSync(tmpPath)) {
        fs.mkdirSync(tmpPath, { recursive: true });
      }

      fs.copyFileSync(lettaCorePath, path.join(tmpPath, 'letta-server'));

      sudo.exec(
        `cp ${path.join(tmpPath, 'letta-server')} /usr/local/bin/letta-server`,
        { name: 'Letta' },
        (error) => {
          if (error) {
            console.error(error);
            reject();
            return;
          }

          // delete tmp file
          fs.unlinkSync(path.join(tmpPath, 'letta-server'));

          resolve(true);
        },
      );
    });
  } else {
    // if windows based install in `C:\Program Files\Letta`
    // mkdir if not exists

    if (!fs.existsSync('C:\\Program Files\\Letta')) {
      fs.mkdirSync('C:\\Program Files\\Letta', { recursive: true });
    }
    fs.copyFileSync(
      lettaCorePath,
      'C:\\Program Files\\Letta\\letta-server.exe',
    );
  }

  await App.lettaStartupRouting();
}

ipcMain.handle('install-letta', (event) => {
  copyLettaToBin();

  return true;
});

ipcMain.handle('set-to-dashboard-size', () => {
  App.mainWindow.setSize(1200, 800);
  // center
  App.mainWindow.center();
});

// Handle App termination
ipcMain.on('quit', (event, code) => {
  app.exit(code);
});
