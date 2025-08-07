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

type GetToolErrorsMetricsRequest = ServerInferRequest<
  typeof contracts.observability.getToolErrorsMetrics
>;

type GetToolErrorsMetricsResponse = ServerInferResponses<
  typeof contracts.observability.getToolErrorsMetrics
>;

export async function getToolErrorsMetrics(
  request: GetToolErrorsMetricsRequest,
): Promise<GetToolErrorsMetricsResponse> {
  const { projectId, startDate, endDate, baseTemplateId, timeRange } =
    request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Get time granularity configuration
  const granularity = getTimeConfig(timeRange || '30d');

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getToolErrorsMetrics,
        200
      >
    >('tool_errors_metrics', {
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
        count() as error_count
      FROM otel_traces
      PREWHERE Timestamp >= {startDate: DateTime} AND Timestamp <= {endDate: DateTime}
      WHERE SpanName = 'agent_step'
        AND TraceId IN (SELECT TraceId FROM parent_traces)
        AND arrayExists(
          event -> event.Attributes['success'] = 'false' AND event.Attributes['tool_name'] != 'send_message',
          Events
        )
      GROUP BY time_interval
      ORDER BY time_interval DESC
    `,
    query_params: {
      baseTemplateId,
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      organizationId: user.activeOrganizationId,
      projectId,
    },
    format: 'JSONEachRow',
  });

  const response = await getClickhouseData<
    Array<{
      time_interval: string;
      error_count: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.time_interval,
      errorCount: parseInt(item.error_count, 10),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'tool_errors_metrics',
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
    console.error('Failed to cache tool errors metrics:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
