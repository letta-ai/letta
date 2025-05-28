import { getClickhouseClient } from '../getClickhouseClient/getClickhouseClient';
import type { OtelTrace } from '@letta-cloud/types';
import { getClickhouseData } from '../getClickhouseData/getClickhouseData';

interface GetTimeToFirstTokenTracesOptions {
  projectId: string;
  startUnixTimestamp: number;
  endUnixTimestamp: number;
}

interface TimeToFirstTokenTrace {
  traceId: string;
  agentId: string;
  timeToFirstTokenMs: number;
}

export async function getTimeToFirstTokenTraces(
  options: GetTimeToFirstTokenTracesOptions,
): Promise<TimeToFirstTokenTrace[]> {
  const client = getClickhouseClient();

  const { projectId, startUnixTimestamp, endUnixTimestamp } = options;

  if (!client) {
    return [];
  }

  try {
    const result = await client.query({
      query: `
        SELECT *
        FROM otel_traces
        WHERE TraceId IN (
          SELECT TraceId
          FROM otel_traces
          WHERE ParentSpanId = ''
            AND SpanName = 'POST /v1/agents/{agent_id}/messages/stream'
            AND SpanAttributes['project.id'] = '${projectId}'
            AND Timestamp >= toDate(${startUnixTimestamp})
            AND Timestamp <= toDate(${endUnixTimestamp})
          ) and SpanName = 'time_to_first_token'
      `,
      format: 'JSONEachRow',
    });

    const response = await getClickhouseData<OtelTrace[]>(result);

    return response.map((trace) => ({
      traceId: trace.TraceId,
      agentId: trace.SpanAttributes['agent.id'],
      timeToFirstTokenMs: trace.Duration / 1000, // Convert from nanoseconds to milliseconds
    }));
  } catch (error) {
    return [];
  }
}
