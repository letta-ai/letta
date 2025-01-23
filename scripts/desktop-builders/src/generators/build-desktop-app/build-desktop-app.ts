import type {
  Tree,
} from '@nx/devkit';
import { execSync } from 'child_process';
import * as fs from 'node:fs';

const isWindows = process.platform === 'win32';

export async function buildDesktopAppGenerator(
  tree: Tree,
) {
  // remove old dist folders
  if (tree.exists('dist/apps/desktop-ui')) {
    fs.rmSync(`${tree.root}/dist/apps/desktop-ui`, { recursive: true });
  }

  if (tree.exists('apps/desktop-electron/dist')) {
    fs.rmSync(`${tree.root}/apps/desktop-electron/dist`, { recursive: true });
  }

  console.log('Building Desktop UI App');
  execSync('NODE_ENV=production npx nx build desktop-ui', {
    cwd: tree.root,
    stdio: 'inherit',
  });

  execSync('npx nx build desktop-electron --production', {
    cwd: tree.root,
    stdio: 'inherit',
  });

  // copy the desktop-ui dist folder to the desktop-electron dist folder
  fs.cpSync(`${tree.root}/dist/apps/desktop-ui`, `${tree.root}/apps/desktop-electron/dist/`, { recursive: true });

  // copy alembic files to the desktop-electron dist folder
  fs.cpSync(`${tree.root}/apps/core/alembic`, `${tree.root}/apps/desktop-electron/dist/alembic`, { recursive: true });

  // copy alembic.ini to the desktop-electron dist folder
  fs.cpSync(`${tree.root}/apps/core/alembic.ini`, `${tree.root}/apps/desktop-electron/dist/alembic.ini`);

  // copy generated letta application files to the desktop-electron dist folder
  const lettaFileName = isWindows ? 'letta.exe' : 'letta';

  fs.cpSync(`${tree.root}/apps/desktop-core/dist/${lettaFileName}`, `${tree.root}/apps/desktop-electron/dist/${lettaFileName}`);
}

export default buildDesktopAppGenerator;
