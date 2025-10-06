import pg from 'pg';
import * as Sentry from '@sentry/node';

import { processStep } from '@letta-cloud/utils-server';

import './instrumentation';

import type { Step } from '@letta-cloud/sdk-core';
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env') });
import './instrumentation';
import express from 'express';
import { testRedisConnection } from '@letta-cloud/service-redis';

const CORE_DATABASE_URL = `postgresql://${process.env.LETTA_PG_USER}:${process.env.LETTA_PG_PASSWORD}@${process.env.LETTA_PG_HOST}:${process.env.LETTA_PG_PORT}/${process.env.LETTA_PG_DB}`;

let _listenerClient: pg.Client | null = null;
let endpointClient: pg.Client | null = null;

async function serve() {
  const { Client } = pg;

  console.log('[Undertaker] Connecting to core database');

  const client = new Client({
    connectionString: CORE_DATABASE_URL,
    ssl: CORE_DATABASE_URL.includes('psdb')
  });

  const client2 = new Client({
    connectionString: CORE_DATABASE_URL,
    ssl: CORE_DATABASE_URL.includes('psdb')
  });

  console.log('[Undertaker] Connected to core database');

  async function initDatabase() {
    await client.connect();
    await client2.connect();

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
        const transaction = await processStep(row);

        if (!transaction) {
          return;
        } else {
          console.log('[Undertaker] Processed existing step', row.id);
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
        try {
          const parsedPayload = JSON.parse(msg.payload) as Step;
          console.log('[Undertaker] Received new step', parsedPayload.id);
          const transaction = await processStep(parsedPayload);

          if (!transaction) {
            return;
          }

          console.log(
            '[Undertaker] Deducted credits from step',
            transaction.transactionId,
          );

          // set tid column of the step to the current transaction id
          await client.query('UPDATE steps SET tid = $1 WHERE id = $2', [
            transaction.transactionId,
            parsedPayload.id,
          ]);
        } catch (e) {
          Sentry.captureException(e);
          console.error(e);
        }
      }
    });
  }

  await initDatabase();
  await Promise.all([backfillSteps(), listenToDatabase()]);

  _listenerClient = client;
  endpointClient = client2;
}

const app = express();

app.get('/health', (_req, res) => {
  res.send('ok');
});

app.post('/charge/:step_id', async (req, res) => {
  const { step_id } = req.params;

  try {
    if (!endpointClient) {
      return res.status(503).json({ error: 'Database not ready' });
    }

    const { rows } = await endpointClient.query('SELECT * FROM steps WHERE id = $1', [step_id]);

    if (rows.length === 0) {
      // return 200 for security reasons, so people can't probe for valid step ids
      return res.status(200).json({
        success: true,
      });
    }

    const step = rows[0] as Step;
    console.log('[Undertaker] Manually processing step', step.id);
    await processStep(step);

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[Undertaker] Error processing charge request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function testClientDatabase() {
  console.log('[Undertaker] Testing client database connection');
  const client = new pg.Client({
    connectionString: CORE_DATABASE_URL,
    ssl: CORE_DATABASE_URL.includes('psdb')
  });

  await client.connect();

  await client.end();

  console.log('[Undertaker] Client database connection successful');
}

async function testWebDatabaseConnection() {
  console.log('[Undertaker] Testing web database connection');
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  await client.end();

  console.log('[Undertaker] Web database connection successful');
}

const port = process.env.PORT || 3009;

Promise.all([
  testClientDatabase(),
  testWebDatabaseConnection(),
  testRedisConnection(),
])
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
