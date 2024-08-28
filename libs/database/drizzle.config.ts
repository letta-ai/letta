import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { resolve } from 'path';
import * as path from 'node:path';

config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  schema: path.join(__dirname, 'src', 'schemas', 'index.ts'),
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
