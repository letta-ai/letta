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

type GetStepDurationMetricsRequest = ServerInferRequest<
  typeof contracts.observability.getStepDurationMetrics
>;

type GetStepDurationMetricsResponse = ServerInferResponses<
  typeof contracts.observability.getStepDurationMetrics
>;

export async function getStepDurationMetrics(
  request: GetStepDurationMetricsRequest,
): Promise<GetStepDurationMetricsResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getStepDurationMetrics,
        200
      >
    >('step_duration_metrics', {
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
        step_name,
        count() as count,
        quantile(0.50)(step_duration_ns) as p50_duration_ns,
        quantile(0.99)(step_duration_ns) as p99_duration_ns
      FROM (
        SELECT
          agent.Timestamp,
          agent.step_name,
          agent.step_duration_ns
        FROM (
          SELECT
            Timestamp,
            TraceId,
            arrayFirst(event -> event.Name = 'tool_execution_completed', Events).Attributes['tool_name'] as step_name,
            CAST(arrayFirst(event -> event.Name = 'step_ms', Events).Attributes['duration_ms'] AS Float64) * 1000000 as step_duration_ns
          FROM otel_traces
          WHERE SpanName = 'agent_step'
            AND arrayExists(event -> event.Name = 'step_ms', Events)
            AND arrayExists(event -> event.Name = 'tool_execution_completed', Events)
        ) AS agent
        WHERE agent.TraceId IN (
          SELECT DISTINCT TraceId
          FROM otel_traces
          WHERE (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
                 SpanName = 'POST /v1/agents/{agent_id}/messages' OR
                 SpanName = 'POST /v1/agents/{agent_id}/messages/async')
            AND SpanAttributes['organization.id'] = {organizationId: String}
            AND SpanAttributes['project.id'] = {projectId: String}
            AND ParentSpanId = ''
            AND Timestamp >= {startDate: DateTime}
            AND Timestamp <= {endDate: DateTime}
            ${attachFilterByBaseTemplateIdToOtels(request.query)}
        )
      )
      WHERE step_duration_ns IS NOT NULL AND step_name IS NOT NULL AND step_name != ''
      GROUP BY date, step_name
      ORDER BY date DESC, step_name ASC
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
      step_name: string;
      count: string;
      p50_duration_ns: string;
      p99_duration_ns: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.date,
      stepName: item.step_name,
      count: parseInt(item.count, 10),
      p50DurationNs: parseInt(item.p50_duration_ns, 10),
      p99DurationNs: parseInt(item.p99_duration_ns, 10),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'step_duration_metrics',
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
    console.error('Failed to cache step duration metrics:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
