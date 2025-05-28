import { getClickhouseClient } from '../getClickhouseClient/getClickhouseClient';
import { getClickhouseData } from '../getClickhouseData/getClickhouseData';

interface GetTimeToFirstTokenAveragesOptions {
  projectId: string;
  startUnixTimestamp: number;
  endUnixTimestamp: number;
}

interface QueryResult {
  date: string;
  avg_time_to_first_token_ns: number;
  avg_time_to_first_token_ms: number;
  sample_count: number;
}

export async function getTimeToFirstTokenAverages(
  options: GetTimeToFirstTokenAveragesOptions,
): Promise<QueryResult[]> {
  const client = getClickhouseClient();

  const { projectId, startUnixTimestamp, endUnixTimestamp } = options;

  if (!client) {
    return [];
  }

  try {
    const result = await client.query({
      query: `
        SELECT
          toDate(Timestamp) as date,
    avg(Duration) as avg_time_to_first_token_ns,
    avg(Duration) / 1000000 as avg_time_to_first_token_ms,
    count() as sample_count
        FROM otel_traces
        WHERE TraceId IN (
          SELECT TraceId
          FROM otel_traces
          WHERE ParentSpanId = ''
          AND SpanName = 'POST /v1/agents/{agent_id}/messages/stream'
          AND SpanAttributes['project.id'] = '${projectId}'
          AND Timestamp >= toDate(${startUnixTimestamp})
          AND Timestamp <= toDate(${endUnixTimestamp})
          )
          AND SpanName = 'time_to_first_token'
        GROUP BY toDate(Timestamp)
        ORDER BY date;
      `,
      format: 'JSONEachRow',
    });

    const response = await getClickhouseData<QueryResult[]>(result);

    return response.map((item) => ({
      date: item.date,
      avg_time_to_first_token_ns: item.avg_time_to_first_token_ns,
      avg_time_to_first_token_ms: item.avg_time_to_first_token_ms,
      sample_count: item.sample_count,
    }));
  } catch (error) {
    return [];
  }
}
