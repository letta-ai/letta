import type { QueryResult } from '@clickhouse/client';

export function getClickhouseData<T>(
  data: QueryResult<'JSONEachRow'>,
): Promise<T> {
  return data.json() as Promise<T>;
}
