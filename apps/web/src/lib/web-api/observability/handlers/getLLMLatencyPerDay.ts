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
import { getTimeConfig } from '$web/client/hooks/useObservabilityContext/timeConfig';

type GetLLMLatencyPerDayRequest = ServerInferRequest<
  typeof contracts.observability.getLLMLatencyPerDay
>;

type GetLLMLatencyPerDayResponse = ServerInferResponses<
  typeof contracts.observability.getLLMLatencyPerDay
>;

export async function getLLMLatencyPerDay(
  request: GetLLMLatencyPerDayRequest,
): Promise<GetLLMLatencyPerDayResponse> {
  const { projectId, startDate, endDate, baseTemplateId, timeRange } =
    request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Get time granularity configuration
  const granularity = getTimeConfig(timeRange || '30d');

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getLLMLatencyPerDay,
        200
      >
    >('llm_latency_per_day', {
      projectId,
      startDate,
      endDate,
      baseTemplateId,
      timeRange,
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
        WITH parent_traces AS (
            SELECT TraceId
            FROM otel_traces
            PREWHERE Timestamp >= {startDate: DateTime} AND Timestamp <= {endDate: DateTime}
            WHERE SpanName IN ('POST /v1/agents/{agent_id}/messages/stream', 'POST /v1/agents/{agent_id}/messages', 'POST /v1/agents/{agent_id}/messages/async')
              AND ParentSpanId = ''
              AND SpanAttributes['project.id'] = {projectId: String}
              AND SpanAttributes['organization.id'] = {organizationId: String}
              ${attachFilterByBaseTemplateIdToOtels(request.query)}
        )
        SELECT
            ${granularity.clickhouseDateFormat} as time_interval,
            quantile(0.50)(CAST(duration_ms AS Float64)) AS p50_latency_ms,
            quantile(0.99)(CAST(duration_ms AS Float64)) AS p99_latency_ms
        FROM (
            SELECT
                Timestamp,
                arrayFirst(event -> event.Name = 'llm_request_ms', Events).Attributes['duration_ms'] AS duration_ms
            FROM otel_traces
            PREWHERE Timestamp >= {startDate: DateTime} AND Timestamp <= {endDate: DateTime}
            WHERE SpanName = 'agent_step'
              AND TraceId IN (SELECT TraceId FROM parent_traces)
              AND arrayExists(event -> event.Name = 'llm_request_ms', Events)
        )
        WHERE duration_ms IS NOT NULL
        GROUP BY time_interval
        ORDER BY time_interval DESC
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      organizationId: user.activeOrganizationId,
      projectId,
      baseTemplateId,
    },
    format: 'JSONEachRow',
  });

  const response = await getClickhouseData<
    Array<{
      time_interval: string;
      p50_latency_ms: string;
      p99_latency_ms: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.time_interval,
      count: 0,
      avgLatencyMs: 0,
      p50LatencyMs: parseFloat(item.p50_latency_ms),
      p99LatencyMs: parseFloat(item.p99_latency_ms),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'llm_latency_per_day',
      {
        projectId,
        startDate,
        endDate,
        baseTemplateId,
        timeRange,
        organizationId: user.activeOrganizationId,
      },
      responseBody,
    );
  } catch (error) {
    // If caching fails, still return the result
    console.error('Failed to cache LLM latency per day:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
