import pg from 'pg';
import * as Sentry from '@sentry/node';
import { config } from 'dotenv';
import { resolve } from 'path';
import { deductCreditsFromStep } from '@letta-cloud/server-utils';
config({ path: resolve(__dirname, '.env') });

const CORE_DATABASE_URL = `postgresql://${process.env.LETTA_PG_USER}:${process.env.LETTA_PG_PASSWORD}@${process.env.LETTA_PG_HOST}:${process.env.LETTA_PG_PORT}/${process.env.LETTA_PG_DB}`;

async function serve() {
  const { Client } = pg;

  const client = new Client({
    connectionString: CORE_DATABASE_URL,
  });

  async function initDatabase() {
    await client.connect();

    await client.query(`CREATE OR REPLACE FUNCTION notify_step() RETURNS TRIGGER AS $$
  BEGIN
    PERFORM pg_notify('new_step', row_to_json(NEW)::text);
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;`);

    await client.query(`
  DO
$$BEGIN
CREATE TRIGGER notify_step_trigger
AFTER INSERT ON steps
FOR EACH ROW
EXECUTE FUNCTION notify_step();
EXCEPTION
WHEN duplicate_object THEN NULL;
END;$$;
  `);
  }

  async function listenToDatabase() {
    await client.query('LISTEN new_step');

    client.on('notification', async (msg) => {
      if (msg.payload) {
        await deductCreditsFromStep(JSON.parse(msg.payload));
      }
    });
  }

  await initDatabase();
  await listenToDatabase();
}

serve().catch((e) => {
  Sentry.captureException(e);
  console.error(e);
  process.exit(1);
});
