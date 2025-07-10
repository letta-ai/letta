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

type GetToolErrorRatePerDayRequest = ServerInferRequest<
  typeof contracts.observability.getToolErrorRatePerDay
>;

type GetToolErrorRatePerDayResponse = ServerInferResponses<
  typeof contracts.observability.getToolErrorRatePerDay
>;

export async function getToolErrorRatePerDay(
  request: GetToolErrorRatePerDayRequest,
): Promise<GetToolErrorRatePerDayResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getToolErrorRatePerDay,
        200
      >
    >('tool_error_rate_per_day', {
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
        toDate(time_window) as date,
        SUM(CASE WHEN tool_execution_success = 'false' THEN value ELSE 0 END) as error_count,
        SUM(value) as total_count,
        CASE
          WHEN SUM(value) > 0
          THEN (SUM(CASE WHEN tool_execution_success = 'false' THEN value ELSE 0 END) / SUM(value)) * 100
          ELSE 0
        END as error_rate
      FROM otel.letta_metrics_counters_1hour_view
      WHERE metric_name = 'count_tool_execution'
        AND organization_id = {organizationId: String}
        AND project_id = {projectId: String}
        AND time_window >= toDateTime({startDate: UInt32})
        AND time_window <= toDateTime({endDate: UInt32})
        AND tool_name != 'send_message'
        ${attachFilterByBaseTemplateIdToMetricsCounters(request.query)}
      GROUP BY toDate(time_window)
      ORDER BY date DESC
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
      error_count: string;
      total_count: string;
      error_rate: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.date,
      errorCount: parseInt(item.error_count, 10),
      totalCount: parseInt(item.total_count, 10),
      errorRate: parseFloat(item.error_rate),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'tool_error_rate_per_day',
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
    console.error('Failed to cache tool error rate per day:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
