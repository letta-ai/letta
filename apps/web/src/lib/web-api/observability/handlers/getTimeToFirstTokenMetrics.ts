import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';

type GetTimeToFirstTokenMetricsRequest = ServerInferRequest<
  typeof contracts.observability.getTimeToFirstTokenMetrics
>;

type GetTimeToFirstTokenMetricsResponse = ServerInferResponses<
  typeof contracts.observability.getTimeToFirstTokenMetrics
>;

export async function getTimeToFirstTokenMetrics(
  request: GetTimeToFirstTokenMetricsRequest,
): Promise<GetTimeToFirstTokenMetricsResponse> {
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
      SELECT
        toDate(time_window) as date,
        sum(count) as sample_count,
        CASE WHEN sum(count) > 0 THEN sum(sum) / sum(count) ELSE 0 END as avg_time_to_first_token_ms
      FROM otel.letta_metrics_histograms_5min
      WHERE metric_name = 'hist_ttft_ms'
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
      projectId,
      organizationId: user.activeOrganizationId,
    },
    format: 'JSONEachRow',
  });

  interface QueryResult {
    date: string;
    avg_time_to_first_token_ms: number;
    sample_count: number;
  }

  const response = await getClickhouseData<QueryResult[]>(result);

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.date,
        averageTimeToFirstTokenMs: parseFloat(
          item.avg_time_to_first_token_ms.toString(),
        ),
        sampleCount: parseInt(item.sample_count.toString(), 10),
      })),
    },
  };
}
