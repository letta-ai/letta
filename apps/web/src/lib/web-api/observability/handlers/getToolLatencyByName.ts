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

type GetToolLatencyByNameRequest = ServerInferRequest<
  typeof contracts.observability.getToolLatencyByName
>;

type GetToolLatencyByNameResponse = ServerInferResponses<
  typeof contracts.observability.getToolLatencyByName
>;

export async function getToolLatencyByName(
  request: GetToolLatencyByNameRequest,
): Promise<GetToolLatencyByNameResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getToolLatencyByName,
        200
      >
    >('tool_latency_by_name', {
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
  tool_name,
  quantile(0.99)(CAST(duration_ms AS Float64)) AS p99_latency_ms,
  quantile(0.50)(CAST(duration_ms AS Float64)) AS p50_latency_ms
      FROM (
        SELECT
        Timestamp,
        arrayFirst(
        event -> has(event.Attributes, 'tool_name') AND has(event.Attributes, 'duration_ms'),
        Events
        ).Attributes['tool_name'] AS tool_name,
        arrayFirst(
        event -> has(event.Attributes, 'tool_name') AND has(event.Attributes, 'duration_ms'),
        Events
        ).Attributes['duration_ms'] AS duration_ms
        FROM otel_traces
        WHERE SpanName = 'agent_step'
        AND arrayExists(
        event -> has(event.Attributes, 'tool_name') AND has(event.Attributes, 'duration_ms'),
        Events
        )
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
        )
      WHERE duration_ms IS NOT NULL AND tool_name IS NOT NULL
      GROUP BY toDate(Timestamp), tool_name
      ORDER BY date, tool_name

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
      date: string;
      tool_name: string;
      count: string;
      avg_latency_ms: string;
      p50_latency_ms: string;
      p99_latency_ms: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.date,
      toolName: item.tool_name,
      count: parseInt(item.count, 10),
      avgLatencyMs: parseFloat(item.avg_latency_ms),
      p50LatencyMs: parseFloat(item.p50_latency_ms),
      p99LatencyMs: parseFloat(item.p99_latency_ms),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'tool_latency_by_name',
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
    console.error('Failed to cache tool latency by name:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
