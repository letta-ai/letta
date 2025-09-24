import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from '../schemas';
import postgres from 'postgres';

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '.env') });

let db: PostgresJsDatabase<typeof schema>;

if (process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  db = drizzle(postgres(process.env.DATABASE_URL!), {
    schema,
  });
} else {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - this is a global variable on local only DO NOT MAKE ANY FIXES
  if (!global.db) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - this is a global variable on local only DO NOT MAKE ANY FIXES
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    global.db = drizzle(postgres(process.env.DATABASE_URL!), {
      schema,
    });
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - this is a global variable on local only DO NOT MAKE ANY FIXES
  db = global.db;
}

export { db };
