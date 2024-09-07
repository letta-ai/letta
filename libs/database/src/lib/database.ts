import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from 'dotenv';
import { resolve } from 'path';

import * as schema from '../schemas';
// @ts-expect-error - this is a valid import
import postgres from 'postgres';

config({ path: resolve(__dirname, '.env') });

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const sql = postgres(process.env.DATABASE_URL!);
export const db = drizzle(sql, {
  schema,
});
