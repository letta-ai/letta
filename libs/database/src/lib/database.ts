import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { resolve } from 'path';

import * as schema from '../schemas';
export * from '../schemas';

config({ path: resolve(__dirname, '.env') });

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, {
  schema,
});
