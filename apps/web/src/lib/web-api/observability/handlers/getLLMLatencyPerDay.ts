import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';

type GetLLMLatencyPerDayRequest = ServerInferRequest<
  typeof contracts.observability.getLLMLatencyPerDay
>;

type GetLLMLatencyPerDayResponse = ServerInferResponses<
  typeof contracts.observability.getLLMLatencyPerDay
>;

export async function getLLMLatencyPerDay(
  request: GetLLMLatencyPerDayRequest,
): Promise<GetLLMLatencyPerDayResponse> {
  const { projectId, startDate, endDate } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();
  const client = getClickhouseClient();

  if (!client) {
    return {
      status: 200,
      body: {
        items: [],
      },
    };
  }

  const result = await client.query({
    query: `
        SELECT
            toDate(Timestamp) as date,
  quantile(0.99)(CAST(duration_ms AS Float64)) AS p99_latency_ms,
  quantile(0.50)(CAST(duration_ms AS Float64)) AS p50_latency_ms
        FROM (
            SELECT
            Timestamp,
            arrayFirst(event -> event.Name = 'llm_request_ms', Events).Attributes['duration_ms'] AS duration_ms
            FROM otel_traces
            WHERE SpanName = 'agent_step'
            AND TraceId IN (
            SELECT DISTINCT TraceId
            FROM otel_traces
            WHERE (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
            SpanName = 'POST /v1/agents/{agent_id}/messages' OR
            SpanName = 'POST /v1/agents/{agent_id}/messages/async')
            AND SpanAttributes['project.id'] = {projectId: String}
            AND SpanAttributes['organization.id'] = {organizationId: String}
            AND ParentSpanId = ''
            AND Timestamp >= {startDate: DateTime}
            AND Timestamp <= {endDate: DateTime}
            )
            AND arrayExists(
            event -> event.Name = 'llm_request_ms',
            Events
            )
            )
        WHERE duration_ms IS NOT NULL
        GROUP BY toDate(Timestamp)
        ORDER BY date
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      organizationId: user.activeOrganizationId,
      projectId,
    },
    format: 'JSONEachRow',
  });

  const response = await getClickhouseData<
    Array<{
      date: string;
      count: string;
      avg_latency_ms: string;
      p50_latency_ms: string;
      p99_latency_ms: string;
    }>
  >(result);

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.date,
        count: parseInt(item.count, 10),
        avgLatencyMs: parseFloat(item.avg_latency_ms),
        p50LatencyMs: parseFloat(item.p50_latency_ms),
        p99LatencyMs: parseFloat(item.p99_latency_ms),
      })),
    },
  };
}
