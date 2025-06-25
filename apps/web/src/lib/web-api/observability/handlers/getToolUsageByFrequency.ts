import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { attachFilterByBaseTemplateIdToMetricsCounters } from '$web/web-api/observability/utils/attachFilterByBaseTemplateIdToMetricsCounters/attachFilterByBaseTemplateIdToMetricsCounters';

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
        SUM(value) as usage_count
      FROM otel.letta_metrics_counters_1hour_view
      WHERE metric_name = 'count_tool_execution'
        AND organization_id = {organizationId: String}
        AND project_id = {projectId: String}
        AND time_window >= toDateTime({startDate: UInt32})
        AND time_window <= toDateTime({endDate: UInt32})
        AND tool_name != ''
        ${attachFilterByBaseTemplateIdToMetricsCounters(request.query)}
      GROUP BY toDate(time_window), tool_name
      ORDER BY date DESC, usage_count DESC
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

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.date,
        toolName: item.tool_name,
        usageCount: parseInt(item.usage_count, 10),
      })),
    },
  };
}
