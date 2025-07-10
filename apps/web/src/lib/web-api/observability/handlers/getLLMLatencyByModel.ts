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

type GetLLMLatencyByModelRequest = ServerInferRequest<
  typeof contracts.observability.getLLMLatencyByModel
>;

type GetLLMLatencyByModelResponse = ServerInferResponses<
  typeof contracts.observability.getLLMLatencyByModel
>;

export async function getLLMLatencyByModel(
  request: GetLLMLatencyByModelRequest,
): Promise<GetLLMLatencyByModelResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getLLMLatencyByModel,
        200
      >
    >('llm_latency_by_model', {
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
      SELECT toDate(Timestamp) as date,
  llm_handle,
  quantile(0.99)(duration_ms_float) AS p99_latency_ms,
  quantile(0.50)(duration_ms_float) AS p50_latency_ms
      FROM (
        SELECT
        agent.Timestamp, agent.duration_ms_float, ttft.handle AS llm_handle
        FROM (
        SELECT
        Timestamp, TraceId, ParentSpanId, arrayFirst(event -> event.Name = 'llm_request_ms', Events).Attributes['duration_ms'] AS duration_ms, toFloat64OrNull(arrayFirst(event -> event.Name = 'llm_request_ms', Events).Attributes['duration_ms']) AS duration_ms_float
        FROM otel_traces
        WHERE SpanName = 'agent_step'
        AND arrayExists(
        event -> event.Name = 'llm_request_ms', Events
        )
        ) AS agent
        INNER JOIN (
        SELECT
        TraceId, ParentSpanId, SpanAttributes['llm_config.handle'] AS handle
        FROM otel_traces
        WHERE SpanName = 'time_to_first_token'
        AND has(SpanAttributes, 'llm_config.handle')
        ) AS ttft ON agent.TraceId = ttft.TraceId AND agent.ParentSpanId = ttft.ParentSpanId
        WHERE agent.TraceId IN (
        SELECT DISTINCT TraceId
        FROM otel_traces
        WHERE (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
        SpanName = 'POST /v1/agents/{agent_id}/messages' OR
        SpanName = 'POST /v1/agents/{agent_id}/messages/async')
        AND SpanAttributes['organization.id'] = {organizationId: String}
        AND SpanAttributes['project.id'] = {projectId: String}
        AND ParentSpanId = ''
        ${attachFilterByBaseTemplateIdToOtels(request.query)}
        )
        )
      WHERE duration_ms_float IS NOT NULL AND llm_handle IS NOT NULL
      GROUP BY date, llm_handle
      ORDER BY date, llm_handle
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
      llm_handle: string;
      p50_latency_ms: string;
      p99_latency_ms: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.date,
      modelName: item.llm_handle,
      p50LatencyMs: parseFloat(item.p50_latency_ms),
      p99LatencyMs: parseFloat(item.p99_latency_ms),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'llm_latency_by_model',
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
    console.error('Failed to cache LLM latency by model:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
