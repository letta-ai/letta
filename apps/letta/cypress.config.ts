import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

import { defineConfig } from 'cypress';
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  projectId: process.env.CYPRESS_PROJECT_KEY || '7kya1h',
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'cypress', bundler: 'vite' }),
    baseUrl: 'http://localhost:3000',
    defaultCommandTimeout: 10000,
  },
  env: {
    googleRefreshToken: process.env.CYPRESS_GOOGLE_REFRESH_TOKEN,
    googleClientId: process.env.CYPRESS_GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.CYPRESS_GOOGLE_CLIENT_SECRET,
  },
});
