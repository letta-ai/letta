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
import { attachFilterByBaseTemplateIdToMetricsCounters } from '$web/web-api/observability/utils/attachFilterByBaseTemplateIdToMetricsCounters/attachFilterByBaseTemplateIdToMetricsCounters';
import { getObservabilityCache, setObservabilityCache } from '../cacheHelpers';

type GetToolErrorsMetricsRequest = ServerInferRequest<
  typeof contracts.observability.getToolErrorsMetrics
>;

type GetToolErrorsMetricsResponse = ServerInferResponses<
  typeof contracts.observability.getToolErrorsMetrics
>;

export async function getToolErrorsMetrics(
  request: GetToolErrorsMetricsRequest,
): Promise<GetToolErrorsMetricsResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

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
        toDate(time_window) as error_date,
        SUM(CASE WHEN tool_execution_success = 'false' THEN value ELSE 0 END) as error_count
      FROM otel.letta_metrics_counters_1hour_view
      WHERE metric_name = 'count_tool_execution'
        AND organization_id = {organizationId: String}
        AND project_id = {projectId: String}
        AND time_window >= toDateTime({startDate: UInt32})
        AND time_window <= toDateTime({endDate: UInt32})
        AND tool_execution_success = 'false'
        AND tool_name != 'send_message'
        ${attachFilterByBaseTemplateIdToMetricsCounters(request.query)}
      GROUP BY toDate(time_window)
      ORDER BY error_date DESC
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
      error_date: string;
      error_count: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.error_date,
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
