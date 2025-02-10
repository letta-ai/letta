import pg from 'pg';
import * as Sentry from '@sentry/node';

import { deductCreditsFromStep } from '@letta-cloud/server-utils';

import './instrumentation';

import type { Step } from '@letta-cloud/letta-agents-api';
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env') });
import './instrumentation';
import express from 'express';
import { testRedisConnection } from '@letta-cloud/redis';

const CORE_DATABASE_URL = `postgresql://${process.env.LETTA_PG_USER}:${process.env.LETTA_PG_PASSWORD}@${process.env.LETTA_PG_HOST}:${process.env.LETTA_PG_PORT}/${process.env.LETTA_PG_DB}`;

async function serve() {
  const { Client } = pg;

  console.log('[Undertaker] Connecting to core database');

  const client = new Client({
    connectionString: CORE_DATABASE_URL,
  });

  console.log('[Undertaker] Connected to core database');

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

  async function backfillSteps() {
    console.log('[Undertaker] Backfilling steps');
    // check the last 24 hours of steps that have no tid
    const { rows } = await client.query(
      "SELECT * FROM steps WHERE tid IS NULL AND created_at > NOW() - INTERVAL '24 hours'",
    );

    const steps = rows as Step[];

    const filteredSteps = steps.filter(
      (step) =>
        step.model &&
        step.organization_id &&
        step.organization_id !== 'org-00000000-0000-4000-8000-000000000000',
    );

    console.log('[Undertaker] Found steps to backfill', filteredSteps.length);

    await Promise.all(
      filteredSteps.map(async (row) => {
        console.log('[Undertaker] Received new step', row.id);
        const transaction = await deductCreditsFromStep(row);

        if (!transaction) {
          return;
        }

        // set tid column of the step to the current transaction id
        await client.query('UPDATE steps SET tid = $1 WHERE id = $2', [
          transaction.transactionId,
          row.id,
        ]);
      }),
    );
  }

  async function listenToDatabase() {
    await client.query('LISTEN new_step');

    client.on('notification', async (msg) => {
      if (msg.payload) {
        const parsedPayload = JSON.parse(msg.payload) as Step;
        console.log('[Undertaker] Received new step', parsedPayload.id);
        const transaction = await deductCreditsFromStep(parsedPayload);

        if (!transaction) {
          return;
        }

        // set tid column of the step to the current transaction id
        await client.query('UPDATE steps SET tid = $1 WHERE id = $2', [
          transaction.transactionId,
          parsedPayload.id,
        ]);
      }
    });
  }

  await initDatabase();
  await Promise.all([backfillSteps(), listenToDatabase()]);
}

const app = express();

app.get('/health', (_req, res) => {
  res.send('ok');
});

const port = process.env.PORT || 3009;

testRedisConnection()
  .then(() => {
    serve().catch((e) => {
      Sentry.captureException(e);
      console.error(e);
      process.exit(1);
    });

    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((e) => {
    Sentry.captureException(e);
    console.error(e);
    process.exit(1);
  });
