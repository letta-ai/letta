import { getClickhouseClient } from '../getClickhouseClient/getClickhouseClient';
import { getClickhouseData } from '../getClickhouseData/getClickhouseData';

interface GetTotalResponseTimeAveragesOptions {
  projectId: string;
  startUnixTimestamp: number;
  endUnixTimestamp: number;
}

interface QueryResult {
  date: string;
  avg_total_response_time_ns: number;
  avg_total_response_time_ms: number;

  sample_count: number;
}

export async function getTotalResponseTimeAverages(
  options: GetTotalResponseTimeAveragesOptions,
): Promise<QueryResult[]> {
  const client = getClickhouseClient();

  const { projectId, startUnixTimestamp, endUnixTimestamp } = options;

  if (!client) {
    return [];
  }

  try {
    const result = await client.query({
      query: `
        SELECT toDate(Timestamp) as date,
    avg(Duration) as avg_response_time_ns,
    avg(Duration) / 1000000 as avg_total_response_time_ms,
    count() as sample_count
        FROM otel_traces
        WHERE ParentSpanId = ''
          AND SpanName = 'POST /v1/agents/{agent_id}/messages/stream'
          AND SpanAttributes['project.id'] = '${projectId}'
          AND Timestamp >= toDateTime64(${startUnixTimestamp}
            , 9)
          AND Timestamp <= toDateTime64(${endUnixTimestamp}
            , 9)
        GROUP BY toDate(Timestamp)
        ORDER BY date;
      `,
      format: 'JSONEachRow',
    });

    const response = await getClickhouseData<QueryResult[]>(result);

    return response.map((item) => ({
      date: item.date,
      avg_total_response_time_ns: item.avg_total_response_time_ns,
      avg_total_response_time_ms: item.avg_total_response_time_ms,
      sample_count: item.sample_count,
    }));
  } catch (error) {
    return [];
  }
}
