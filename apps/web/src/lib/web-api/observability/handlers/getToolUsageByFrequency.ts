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

type GetToolUsageByFrequencyRequest = ServerInferRequest<
  typeof contracts.observability.getToolUsageByFrequency
>;

type GetToolUsageByFrequencyResponse = ServerInferResponses<
  typeof contracts.observability.getToolUsageByFrequency
>;

export async function getToolUsageByFrequency(
  request: GetToolUsageByFrequencyRequest,
): Promise<GetToolUsageByFrequencyResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getToolUsageByFrequency,
        200
      >
    >('tool_usage_by_frequency', {
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
        tool_name,
        count() as usage_count
      FROM otel.letta_metrics_counters_1hour_view
      WHERE metric_name = 'count_tool_execution'
        AND organization_id = {organizationId: String}
        AND project_id = {projectId: String}
        AND time_window >= toDateTime({startDate: UInt32})
        AND time_window <= toDateTime({endDate: UInt32})
        AND tool_name != ''
      ${attachFilterByBaseTemplateIdToMetricsCounters(request.query)}
      GROUP BY toDate(time_window), tool_name
      ORDER BY date DESC, tool_name
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
      usage_count: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.date,
      toolName: item.tool_name,
      usageCount: parseInt(item.usage_count, 10),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'tool_usage_by_frequency',
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
    console.error('Failed to cache tool usage by frequency:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
