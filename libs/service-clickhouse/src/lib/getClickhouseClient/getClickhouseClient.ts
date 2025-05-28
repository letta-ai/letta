import { createClient } from '@clickhouse/client';
import * as process from 'node:process';

export function getClickhouseClient() {
  if (
    !process.env['CLICKHOUSE_ENDPOINT'] ||
    !process.env['CLICKHOUSE_DATABASE'] ||
    !process.env['CLICKHOUSE_USERNAME'] ||
    !process.env['CLICKHOUSE_PASSWORD']
  ) {
    return null;
  }

  return createClient({
    url: process.env['CLICKHOUSE_ENDPOINT'],
    database: process.env['CLICKHOUSE_DATABASE'],
    username: process.env['CLICKHOUSE_USERNAME'],
    password: process.env['CLICKHOUSE_PASSWORD'],
  });
}
