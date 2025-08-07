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

type GetToolErrorRateByNameRequest = ServerInferRequest<
  typeof contracts.observability.getToolErrorRateByName
>;

type GetToolErrorRateByNameResponse = ServerInferResponses<
  typeof contracts.observability.getToolErrorRateByName
>;

export async function getToolErrorRateByName(
  request: GetToolErrorRateByNameRequest,
): Promise<GetToolErrorRateByNameResponse> {
  const { projectId, startDate, endDate, baseTemplateId, timeRange } =
    request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Get time granularity configuration
  const granularity = getTimeConfig(timeRange || '30d');

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getToolErrorRateByName,
        200
      >
    >('tool_error_rate_by_name', {
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
        ${granularity.clickhouseDateFormat} as date,
        arrayFirst(event -> has(event.Attributes, 'tool_name'), Events).Attributes['tool_name'] as tool_name,
        SUM(CASE WHEN arrayExists(event -> event.Attributes['success'] = 'false', Events) THEN 1 ELSE 0 END) as error_count,
        count() as total_count,
        CASE
          WHEN count() > 0
          THEN (SUM(CASE WHEN arrayExists(event -> event.Attributes['success'] = 'false', Events) THEN 1 ELSE 0 END) / count()) * 100
          ELSE 0
        END as error_rate
      FROM otel_traces
      PREWHERE Timestamp >= {startDate: DateTime} AND Timestamp <= {endDate: DateTime}
      WHERE SpanName = 'agent_step'
        AND TraceId IN (SELECT TraceId FROM parent_traces)
        AND arrayExists(event -> has(event.Attributes, 'tool_name') AND event.Attributes['tool_name'] != 'send_message' AND event.Attributes['tool_name'] != '', Events)
      GROUP BY date, tool_name
      ORDER BY date DESC, tool_name
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
      date: string;
      tool_name: string;
      error_count: string;
      total_count: string;
      error_rate: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.date,
      toolName: item.tool_name,
      errorCount: parseInt(item.error_count, 10),
      totalCount: parseInt(item.total_count, 10),
      errorRate: parseFloat(item.error_rate),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'tool_error_rate_by_name',
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
    console.error('Failed to cache tool error rate by name:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
