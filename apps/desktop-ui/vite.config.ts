/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import * as path from 'path';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/desktop-ui',
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  define: {
    process: {
      env: {
        OVERRIDE_WEB_ORIGIN_SDK_ENDPOINT: 'http://localhost:8283',
        LETTA_AGENTS_ENDPOINT: 'http://localhost:8283/',
        RUNTIME: 'desktop',
      },
    },
  },
  resolve: {
    alias: {
      '@letta-web/environmental-variables': path.resolve(
        __dirname,
        'src/alias-overrides/environmental-variables',
      ),
      'next/navigation': path.resolve(
        __dirname,
        'src/alias-overrides/navigation',
      ),
      'next/link': path.resolve(__dirname, 'src/alias-overrides/Link'),
      'next/image': path.resolve(__dirname, 'src/alias-overrides/Image'),
      path: 'path-browserify',
    },
  },
  build: {
    outDir: '../../dist/apps/desktop-ui',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
