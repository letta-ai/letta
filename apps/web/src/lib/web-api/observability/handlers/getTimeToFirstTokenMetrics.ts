import type {
  ServerInferRequest,
  ServerInferResponses,
  ServerInferResponseBody,
} from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { attachFilterByBaseTemplateIdToOtels } from '$web/web-api/observability/utils/attachFilterByBaseTemplateIdToOtels/attachFilterByBaseTemplateIdToOtels';
import { getObservabilityCache, setObservabilityCache } from '../cacheHelpers';

type GetTimeToFirstTokenMetricsRequest = ServerInferRequest<
  typeof contracts.observability.getTimeToFirstTokenMetrics
>;

type GetTimeToFirstTokenMetricsResponse = ServerInferResponses<
  typeof contracts.observability.getTimeToFirstTokenMetrics
>;

export async function getTimeToFirstTokenMetrics(
  request: GetTimeToFirstTokenMetricsRequest,
): Promise<GetTimeToFirstTokenMetricsResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;
  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getTimeToFirstTokenMetrics,
        200
      >
    >('time_to_first_token_metrics', {
      projectId,
      startDate,
      endDate,
      baseTemplateId,
      organizationId: user.activeOrganizationId,
    });
    if (cachedBody) {
      return {
        status: 200 as const,
        body: cachedBody,
      };
    }
  } catch (_error) {
    return {
      status: 500 as const,
      body: {
        items: [],
      },
    };
  }

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
  quantile(0.99)(toFloat64OrNull(duration_ms)) AS p99_latency_ms,
  quantile(0.50)(toFloat64OrNull(duration_ms)) AS p50_latency_ms
      FROM (
        SELECT
        Timestamp,
        arrayFirst(event -> event.Name = 'time_to_first_token_ms', Events).Attributes['ttft_ms'] AS duration_ms
        FROM otel_traces
        WHERE SpanName = 'time_to_first_token'
        AND TraceId IN (
        SELECT DISTINCT TraceId
        FROM otel_traces
        WHERE (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
        SpanName = 'POST /v1/agents/{agent_id}/messages' OR
        SpanName = 'POST /v1/agents/{agent_id}/messages/async')
        AND SpanAttributes['project.id'] = {projectId: String}
        AND SpanAttributes['organization.id'] = {organizationId: String}
        AND ParentSpanId = ''
        ${attachFilterByBaseTemplateIdToOtels(request.query)}
        AND Timestamp >= {startDate: DateTime}
        AND Timestamp <= {endDate: DateTime}
        )
        AND arrayExists(
        event -> event.Name = 'time_to_first_token_ms',
        Events
        )
        )
      WHERE duration_ms IS NOT NULL
      GROUP BY toDate(Timestamp)
      ORDER BY date
    `,
    query_params: {
      baseTemplateId,
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      projectId,
      organizationId: user.activeOrganizationId,
    },
    format: 'JSONEachRow',
  });

  interface QueryResult {
    date: string;
    p50_latency_ms: string;
    p99_latency_ms: string;
  }

  const response = await getClickhouseData<QueryResult[]>(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.date,
      p50LatencyMs: parseFloat(item.p50_latency_ms),
      p99LatencyMs: parseFloat(item.p99_latency_ms),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'time_to_first_token_metrics',
      {
        projectId,
        startDate,
        endDate,
        baseTemplateId,
        organizationId: user.activeOrganizationId,
      },
      responseBody,
    );
  } catch (error) {
    // If caching fails, still return the result
    console.error('Failed to cache time to first token metrics:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
