const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');




function makeTreeSafePath(path) {
  return path.split('/letta-cloud/')[1];
}

const monoRepoRoot = path.join(__dirname, '../../../../..');


const isWindows = process.platform === 'win32';

function buildPythonAppGenerator() {
  console.log('Building Python App');

  const desktopCorePath = path.join(monoRepoRoot, 'apps', 'desktop-core');

  if (!fs.existsSync(desktopCorePath)) {
    throw new Error(`Desktop Core app not found at ${desktopCorePath}`);
  }

  const venvPath = path.join(desktopCorePath, '.venv');

  // removes all of the path before letta-cloud
  if (fs.existsSync(venvPath) && process.argv.includes('--rebuildDependencies')) {
    fs.rmSync(
      venvPath, { recursive: true });
  }


  if (!fs.existsSync(venvPath)) {
    console.log('Creating virtual environment');
    execSync('uv sync', {
      cwd: desktopCorePath,
      stdio: 'inherit',
      shell: 'bash',
    });
  } else {
    console.log('Virtual environment already exists');
  }

  let depPath = '';

  if (isWindows) {
    depPath = path.join('.venv', 'Lib', 'site-packages');
  } else {
    const { globSync } = require('glob');

    const lookupPath = path.join(venvPath, '**', 'site-packages');

    // site packages could be in .venv/lib/[python-version]/site-packages or .venv/lib/site-packages or .venv/site-packages, so we need to find the correct path
    const possiblePaths = globSync(lookupPath);

    if (possiblePaths.length > 1) {
      throw new Error(`Multiple site-packages found in venv: ${possiblePaths}`);
    }

    if (possiblePaths.length === 0) {
      throw new Error(`No site-packages found in venv: ${lookupPath}`);
    }

     depPath = makeTreeSafePath(possiblePaths[0]).split('/desktop-core/')[1];
  }


  console.log(`Using site-packages at ${depPath}`);

  console.log('Generating app.spec file');
  const appSpec = fs.readFileSync(path.join(__dirname, 'app.spec.template'), 'utf8');

  const appSpecPath = path.join(desktopCorePath, 'app.spec');

  fs.writeFileSync(appSpecPath, appSpec.replace(/DEP_PATH/g, depPath));


  console.log('Remove dist')

  const distPath = path.join(desktopCorePath, 'dist');
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true });
  }

  console.log('Packaging the app');
  execSync('poetry run pyinstaller app.spec', {
    cwd: desktopCorePath,
    stdio: 'inherit',
    shell: 'bash',
  });

  console.log(`Your app is ready at ${path.join(desktopCorePath, 'dist')}`);
}

buildPythonAppGenerator();
