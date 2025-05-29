import { createClient } from '@clickhouse/client';
import * as process from 'node:process';

export function getClickhouseClient(
  database: string = process.env['CLICKHOUSE_DATABASE'] || 'otel',
) {
  if (
    !process.env['CLICKHOUSE_ENDPOINT'] ||
    !process.env['CLICKHOUSE_USERNAME'] ||
    !process.env['CLICKHOUSE_PASSWORD']
  ) {
    return null;
  }

  return createClient({
    url: process.env['CLICKHOUSE_ENDPOINT'],
    database,
    username: process.env['CLICKHOUSE_USERNAME'],
    password: process.env['CLICKHOUSE_PASSWORD'],
  });
}
