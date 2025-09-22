/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import * as path from 'path';

export default defineConfig({
  base: '',
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/docker-ui',
  server: {
    port: 4200,
    host: 'localhost',
    proxy: {
      '/v1': 'http://localhost:8283/',
    }
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
        LETTA_AGENTS_ENDPOINT: '',
      },
    },
  },
  resolve: {
    alias: {
      '@letta-cloud/config-environment-variables': path.resolve(
        __dirname,
        'src/alias-overrides/config-environment-variables',
      ),
      '@letta-cloud/config-runtime': path.resolve(
        __dirname,
        'src/alias-overrides/runtime',
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
    outDir: '../../dist/apps/docker-ui',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
