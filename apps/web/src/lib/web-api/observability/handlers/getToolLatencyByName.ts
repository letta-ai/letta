import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';

type GetToolLatencyByNameRequest = ServerInferRequest<
  typeof contracts.observability.getToolLatencyByName
>;

type GetToolLatencyByNameResponse = ServerInferResponses<
  typeof contracts.observability.getToolLatencyByName
>;

export async function getToolLatencyByName(
  request: GetToolLatencyByNameRequest,
): Promise<GetToolLatencyByNameResponse> {
  const { projectId, startDate, endDate } = request.query;

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
      WITH aggregated AS (
        SELECT
          toDate(time_window) as date,
          tool_name,
          sum(count) as total_count,
          sum(sum) as total_sum
        FROM otel.letta_metrics_histograms_5min
        WHERE metric_name = 'hist_tool_execution_time_ms'
          AND organization_id = {organizationId: String}
          AND project_id = {projectId: String}
          AND time_window >= toDateTime({startDate: UInt32})
          AND time_window <= toDateTime({endDate: UInt32})
          AND tool_name != ''
        GROUP BY toDate(time_window), tool_name
      )
      SELECT
        date,
        tool_name,
        total_count as count,
        CASE WHEN total_count > 0 THEN total_sum / total_count ELSE 0 END as avg_latency_ms
      FROM aggregated
      ORDER BY date DESC, tool_name
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
      date: string;
      tool_name: string;
      count: string;
      avg_latency_ms: string;
      p50_latency_ms: string;
      p99_latency_ms: string;
    }>
  >(result);

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.date,
        toolName: item.tool_name,
        count: parseInt(item.count, 10),
        avgLatencyMs: parseFloat(item.avg_latency_ms),
        p50LatencyMs: 0,
        p99LatencyMs: 0,
      })),
    },
  };
}
