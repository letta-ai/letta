import {
  generateFiles,
  Tree,
} from '@nx/devkit';
import * as path from 'path';
import { execSync } from 'child_process';
import { globSync } from 'glob';
import * as fs from 'node:fs';

interface Options {
  rebuildDependencies: boolean;
}


function makeTreeSafePath(path: string): string {
  return path.split('/letta-cloud/')[1];
}


export async function buildPythonAppGenerator(
  tree: Tree,
  options: Options
) {
  console.log('Building Python App');

  const desktopCorePath = path.join('apps', 'desktop-core');

  if (!tree.exists(desktopCorePath)) {
    throw new Error(`Desktop Core app not found at ${desktopCorePath}`);
  }

  const venvPath = path.join(desktopCorePath, '.venv');

  // removes all of the path before letta-cloud
  if (venvPath && options.rebuildDependencies) {
    fs.rmdirSync(`${tree.root}/${venvPath}`, { recursive: true });
  }

  if (!tree.exists(venvPath)) {
    console.log('Creating virtual environment');
    execSync('npm run desktop:setup-core', {
      cwd: path.join(tree.root, desktopCorePath),
      stdio: 'inherit',
    });
  } else {
    console.log('Virtual environment already exists');
  }

  // site packages could be in .venv/lib/[python-version]/site-packages or .venv/lib/site-packages or .venv/site-packages, so we need to find the correct path
  const possiblePaths = globSync(`${tree.root}/${venvPath}/**/site-packages`);

  if (possiblePaths.length > 1) {
    throw new Error(`Multiple site-packages found in venv: ${possiblePaths}`);
  }

  if (possiblePaths.length === 0) {
    throw new Error(`No site-packages found in venv: ${possiblePaths}`);
  }

  const depPath = makeTreeSafePath(possiblePaths[0]).split('/desktop-core/')[1];

  console.log('Generating app.spec file');
  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    desktopCorePath,
    {
      depPath
    }
  );

  console.log('Remove dist')
  if (fs.existsSync(`${tree.root}/${desktopCorePath}/dist`)) {
    fs.rmdirSync(`${tree.root}/${desktopCorePath}/dist`, { recursive: true });
  }

  console.log('Packaging the app');
  execSync('npm run desktop:package-core', {
    cwd: path.join(tree.root, desktopCorePath),
    stdio: 'inherit',
  });

  console.log(`Your app is ready at ${path.join(tree.root, desktopCorePath, 'dist')}`);
}

export default buildPythonAppGenerator;
