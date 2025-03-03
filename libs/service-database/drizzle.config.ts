import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { resolve } from 'path';
import * as path from 'node:path';
import { workspaceRoot } from '@nx/devkit';

config({ path: resolve(workspaceRoot, '.env') });

export default defineConfig({
  schema: path.join(__dirname, 'src', 'schemas', 'index.ts'),
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
