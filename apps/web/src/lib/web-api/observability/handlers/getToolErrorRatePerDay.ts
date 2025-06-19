import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { attachFilterByBaseTemplateIdToMetricsCounters } from '$web/web-api/observability/utils/attachFilterByBaseTemplateIdToMetricsCounters/attachFilterByBaseTemplateIdToMetricsCounters';

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

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.date,
        errorCount: parseInt(item.error_count, 10),
        totalCount: parseInt(item.total_count, 10),
        errorRate: parseFloat(item.error_rate),
      })),
    },
  };
}
