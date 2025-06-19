import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { attachFilterByBaseTemplateIdToMetricsCounters } from '$web/web-api/observability/utils/attachFilterByBaseTemplateIdToMetricsCounters/attachFilterByBaseTemplateIdToMetricsCounters';

type GetTimeToFirstTokenPerDayRequest = ServerInferRequest<
  typeof contracts.observability.getTimeToFirstTokenPerDay
>;

type GetTimeToFirstTokenPerDayResponse = ServerInferResponses<
  typeof contracts.observability.getTimeToFirstTokenPerDay
>;

export async function getTimeToFirstTokenPerDay(
  request: GetTimeToFirstTokenPerDayRequest,
): Promise<GetTimeToFirstTokenPerDayResponse> {
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
      WITH aggregated AS (
        SELECT
          toDate(time_window) as date,
          sum(count) as total_count,
          sum(sum) as total_sum,
          arrayReduce('sumForEach', groupArray(bucket_counts)) as total_bucket_counts,
          any(explicit_bounds) as bounds
        FROM otel.letta_metrics_histograms_5min
        WHERE metric_name = 'hist_ttft_ms'
          AND organization_id = {organizationId: String}
          AND project_id = {projectId: String}
          AND time_window >= toDateTime({startDate: UInt32})
          AND time_window <= toDateTime({endDate: UInt32})
          ${attachFilterByBaseTemplateIdToMetricsCounters(request.query)}
      GROUP BY toDate(time_window)
      )
      SELECT
        date,
        total_count as count,
        CASE WHEN total_count > 0 THEN total_sum / total_count ELSE 0 END as avg_ttft_ms,
        arrayElement(bounds, arrayFirstIndex(x -> x >= 0.5 * arraySum(total_bucket_counts), arrayCumSum(total_bucket_counts))) as p50_ttft_ms,
        arrayElement(bounds, arrayFirstIndex(x -> x >= 0.99 * arraySum(total_bucket_counts), arrayCumSum(total_bucket_counts))) as p99_ttft_ms
      FROM aggregated
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
      count: string;
      avg_ttft_ms: string;
      p50_ttft_ms: string;
      p99_ttft_ms: string;
    }>
  >(result);

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.date,
        count: parseInt(item.count, 10),
        avgTtftMs: parseFloat(item.avg_ttft_ms),
        p50TtftMs: parseFloat(item.p50_ttft_ms),
        p99TtftMs: parseFloat(item.p99_ttft_ms),
      })),
    },
  };
}
