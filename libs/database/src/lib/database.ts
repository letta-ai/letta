import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from 'dotenv';
import { resolve } from 'path';

import * as schema from '../schemas';
import postgres from 'postgres';

config({ path: resolve(__dirname, '.env') });

// Fix for "sorry, too many clients already"
// dev issue only
declare global {
  // eslint-disable-next-line no-var -- only var works here
  var db: PostgresJsDatabase<typeof schema> | undefined;
}

let db: PostgresJsDatabase<typeof schema>;

if (process.env.NODE_ENV === 'production') {
  db = drizzle(postgres(process.env.DATABASE_URL!), {
    schema,
  });
} else {
  if (!global.db)
    global.db = drizzle(postgres(process.env.DATABASE_URL!), {
      schema,
    });

  db = global.db;
}

export { db };
