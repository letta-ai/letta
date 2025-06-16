import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';

type GetApiErrorCountRequest = ServerInferRequest<
  typeof contracts.observability.getApiErrorCount
>;

type GetApiErrorCountResponse = ServerInferResponses<
  typeof contracts.observability.getApiErrorCount
>;

export async function getApiErrorCount(
  request: GetApiErrorCountRequest,
): Promise<GetApiErrorCountResponse> {
  const client = getClickhouseClient();

  if (!client) {
    return {
      status: 200,
      body: {
        items: [],
      },
    };
  }

  const { projectId, startDate, endDate } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  const result = await client.query({
    query: `
      SELECT
        toDate(time_window) as date,
        SUM(CASE WHEN status_code != '200' THEN value ELSE 0 END) as error_count
      FROM otel.letta_metrics_counters_1hour_view
      WHERE metric_name = 'count_tool_execution'
        AND organization_id = {organizationId: String}
        AND project_id = {projectId: String}
        AND time_window >= toDateTime({startDate: UInt32})
        AND time_window <= toDateTime({endDate: UInt32})
      GROUP BY toDate(time_window)
      ORDER BY date DESC
    `,
    query_params: {
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

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.error_date,
        errorCount: parseInt(item.error_count, 10),
      })),
    },
  };
}
