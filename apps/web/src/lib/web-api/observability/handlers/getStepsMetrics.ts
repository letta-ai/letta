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

type GetStepsMetricsRequest = ServerInferRequest<
  typeof contracts.observability.getStepsMetrics
>;

type GetStepsMetricsResponse = ServerInferResponses<
  typeof contracts.observability.getStepsMetrics
>;

export async function getStepsMetrics(
  request: GetStepsMetricsRequest,
): Promise<GetStepsMetricsResponse> {
  const { projectId, startDate, endDate, baseTemplateId, timeRange } =
    request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Get time granularity configuration
  const granularity = getTimeConfig(timeRange || '30d');

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getStepsMetrics,
        200
      >
    >('steps_metrics', {
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
        SELECT
          TraceId,
          Timestamp
        FROM otel_traces
        PREWHERE Timestamp >= {startDate: DateTime} AND Timestamp <= {endDate: DateTime}
        WHERE SpanName IN ('POST /v1/agents/{agent_id}/messages/stream', 'POST /v1/agents/{agent_id}/messages', 'POST /v1/agents/{agent_id}/messages/async')
          AND ParentSpanId = ''
          AND SpanAttributes['organization.id'] = {organizationId: String}
          AND SpanAttributes['project.id'] = {projectId: String}
          ${attachFilterByBaseTemplateIdToOtels(request.query)}
      ),
      steps_per_trace AS (
        SELECT
          p.Timestamp,
          p.TraceId,
          count() as steps_count
        FROM parent_traces p
        INNER JOIN otel_traces s ON p.TraceId = s.TraceId
        WHERE s.SpanName = 'agent_step'
        GROUP BY p.Timestamp, p.TraceId
      )
      SELECT
        ${granularity.clickhouseDateFormat} as time_interval,
        sum(steps_count) as total_steps_count,
        quantile(0.50)(steps_count) as p50_steps_count,
        quantile(0.99)(steps_count) as p99_steps_count,
        avg(steps_count) as avg_steps_count
      FROM steps_per_trace
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
      total_steps_count: string;
      p50_steps_count: string;
      p99_steps_count: string;
      avg_steps_count: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.time_interval,
      totalStepsCount: parseInt(item.total_steps_count, 10),
      p50StepsCount: parseFloat(item.p50_steps_count),
      p99StepsCount: parseFloat(item.p99_steps_count),
      avgStepsCount: parseFloat(item.avg_steps_count),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'steps_metrics',
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
    console.error('Failed to cache steps metrics:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
