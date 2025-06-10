import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';

type GetToolLatencyPerDayRequest = ServerInferRequest<
  typeof contracts.observability.getToolLatencyPerDay
>;

type GetToolLatencyPerDayResponse = ServerInferResponses<
  typeof contracts.observability.getToolLatencyPerDay
>;

export async function getToolLatencyPerDay(
  request: GetToolLatencyPerDayRequest,
): Promise<GetToolLatencyPerDayResponse> {
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
          sum(count) as total_count,
          sum(sum) as total_sum,
          arrayReduce('sumForEach', groupArray(bucket_counts)) as total_bucket_counts,
          any(explicit_bounds) as bounds
        FROM otel.letta_metrics_histograms_5min
        WHERE metric_name = 'hist_tool_execution_time_ms'
          AND organization_id = {organizationId: String}
          AND project_id = {projectId: String}
          AND time_window >= toDateTime({startDate: UInt32})
          AND time_window <= toDateTime({endDate: UInt32})
        GROUP BY toDate(time_window)
      )
      SELECT
        date,
        total_count as count,
        CASE WHEN total_count > 0 THEN total_sum / total_count ELSE 0 END as avg_latency_ms,
        arrayElement(bounds, arrayFirstIndex(x -> x >= 0.5 * arraySum(total_bucket_counts), arrayCumSum(total_bucket_counts))) as p50_latency_ms,
        arrayElement(bounds, arrayFirstIndex(x -> x >= 0.99 * arraySum(total_bucket_counts), arrayCumSum(total_bucket_counts))) as p99_latency_ms
      FROM aggregated
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
      date: string;
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
        count: parseInt(item.count, 10),
        avgLatencyMs: parseFloat(item.avg_latency_ms),
        p50LatencyMs: parseFloat(item.p50_latency_ms),
        p99LatencyMs: parseFloat(item.p99_latency_ms),
      })),
    },
  };
}
