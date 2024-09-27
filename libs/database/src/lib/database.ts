import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from 'dotenv';
import { resolve } from 'path';

import * as schema from '../schemas';
import postgres from 'postgres';

config({ path: resolve(__dirname, '.env') });

let db: PostgresJsDatabase<typeof schema>;

if (process.env.NODE_ENV === 'production') {
  db = drizzle(postgres(process.env.DATABASE_URL!), {
    schema,
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  // @ts-expect-error - this is a global variable on local only DO NOT MAKE ANY FIXES
  if (!global.db)
    // @ts-expect-error - this is a global variable on local only DO NOT MAKE ANY FIXES
    global.db = drizzle(postgres(process.env.DATABASE_URL!), {
      schema,
    });

  // @ts-expect-error - this is a global variable on local only DO NOT MAKE ANY FIXES
  db = global.db;
}

export { db };
