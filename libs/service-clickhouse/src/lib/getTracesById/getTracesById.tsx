import { getClient } from '../getClient/getClient';
import type { OtelTrace } from '@letta-cloud/types';

export async function getTracesById(traceId: string): Promise<OtelTrace[]> {
  const client = getClient();

  if (!client) {
    return [];
  }

  try {
    const result = await client.query({
      query: `
        SELECT *
        FROM "otel"."otel_traces"
        WHERE (TraceId = '${traceId}') LIMIT 1000
      `,
      format: 'JSONEachRow',
    });

    return await result.json();
  } catch (error) {
    console.error('Error fetching trace by ID:', error);
    return [];
  }
}
