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

type GetToolErrorRatePerDayRequest = ServerInferRequest<
  typeof contracts.observability.getToolErrorRatePerDay
>;

type GetToolErrorRatePerDayResponse = ServerInferResponses<
  typeof contracts.observability.getToolErrorRatePerDay
>;

export async function getToolErrorRatePerDay(
  request: GetToolErrorRatePerDayRequest,
): Promise<GetToolErrorRatePerDayResponse> {
  const { projectId, startDate, endDate, baseTemplateId, timeRange } =
    request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Get time granularity configuration
  const granularity = getTimeConfig(timeRange || '30d');

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
      SELECT
        ${granularity.clickhouseDateFormat.replace('Timestamp', 'time_window')} as time_interval,
        SUM(CASE WHEN tool_execution_success = 'false' THEN value ELSE 0 END) as error_count,
        SUM(value) as total_tool_calls,
        CASE
          WHEN SUM(value) > 0
          THEN (SUM(CASE WHEN tool_execution_success = 'false' THEN value ELSE 0 END) / SUM(value)) * 100
          ELSE 0
        END as error_rate
      FROM otel.letta_metrics_counters_1hour_view
      WHERE metric_name = 'count_tool_execution'
        AND time_window >= toDateTime({startDate: UInt32})
        AND time_window <= toDateTime({endDate: UInt32})
        AND organization_id = {organizationId: String}
        AND project_id = {projectId: String}
        AND tool_name != 'send_message'
        ${attachFilterByBaseTemplateIdToOtels(request.query)}
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
      total_tool_calls: string;
      error_count: string;
      error_rate: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.time_interval,
      totalToolCalls: parseInt(item.total_tool_calls, 10),
      errorCount: parseInt(item.error_count, 10),
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
        timeRange,
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
