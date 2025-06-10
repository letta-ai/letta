import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
type GetObservabilityOverviewRequest = ServerInferRequest<
  typeof contracts.observability.getObservabilityOverview
>;

type GetObservabilityOverviewResponse = ServerInferResponses<
  typeof contracts.observability.getObservabilityOverview
>;

export async function getObservabilityOverview(
  request: GetObservabilityOverviewRequest,
): Promise<GetObservabilityOverviewResponse> {
  const { projectId, startDate, endDate } = request.query;

  const client = getClickhouseClient();

  if (!client) {
    return {
      status: 200,
      body: {
        totalMessageCount: 0,
        totalTokenCount: 0,
        tokenPerMessageMedian: 0,
        apiErrorRate: 0,
        toolErrorRate: 0,
        p50TimeToFirstTokenNs: 0,
        p99TimeToFirstTokenNs: 0,
        p50ResponseTimeNs: 0,
        p99ResponseTimeNs: 0,
      },
    };
  }

  const user = await getUserWithActiveOrganizationIdOrThrow();

  function getAllMessagesCount() {
    return client
      ?.query({
        query: `
      SELECT
        SUM(value) as total_message_count
      FROM otel.letta_metrics_counters_5min_view
      WHERE metric_name = 'count_user_message'
        AND organization_id = {organizationId: String}
        AND project_id = {projectId: String}
        AND time_window >= toDateTime({startDate: UInt32})
        AND time_window <= toDateTime({endDate: UInt32})
    `,
        query_params: {
          projectId,
          organizationId: user.activeOrganizationId,
          startDate: Math.round(new Date(startDate).getTime() / 1000),
          endDate: Math.round(new Date(endDate).getTime() / 1000),
        },
        format: 'JSONEachRow',
      })
      .then((result) =>
        getClickhouseData<
          Array<{
            total_message_count: string;
            error_message_count?: string;
          }>
        >(result),
      )
      .then((v) => ({ ...v[0], error_message_count: '0' })); // API errors not available in metrics
  }

  function getToolErrorsCount() {
    return client
      ?.query({
        query: `
      SELECT
        SUM(CASE WHEN tool_execution_success = 'false' THEN value ELSE 0 END) as tool_error_count
      FROM otel.letta_metrics_counters_5min_view
      WHERE metric_name = 'count_tool_execution'
        AND organization_id = {organizationId: String}
        AND project_id = {projectId: String}
        AND time_window >= toDateTime({startDate: UInt32})
        AND time_window <= toDateTime({endDate: UInt32})
    `,
        query_params: {
          projectId,
          organizationId: user.activeOrganizationId,
          startDate: Math.round(new Date(startDate).getTime() / 1000),
          endDate: Math.round(new Date(endDate).getTime() / 1000),
        },
        format: 'JSONEachRow',
      })
      .then((result) =>
        getClickhouseData<Array<{ tool_error_count: string }>>(result),
      )
      .then((v) => v[0]);
  }

  function getP50AndP99TimeToFirstToken() {
    return client
      ?.query({
        query: `
      WITH aggregated AS (
        SELECT
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
      )
      SELECT
        arrayElement(bounds, arrayFirstIndex(x -> x >= 0.5 * arraySum(total_bucket_counts), arrayCumSum(total_bucket_counts))) as p50_time_to_first_token_ms,
        arrayElement(bounds, arrayFirstIndex(x -> x >= 0.99 * arraySum(total_bucket_counts), arrayCumSum(total_bucket_counts))) as p99_time_to_first_token_ms,
        0 as p50_response_time_ms,
        0 as p99_response_time_ms
      FROM aggregated
    `,
        query_params: {
          projectId,
          organizationId: user.activeOrganizationId,
          startDate: Math.round(new Date(startDate).getTime() / 1000),
          endDate: Math.round(new Date(endDate).getTime() / 1000),
        },
        format: 'JSONEachRow',
      })
      .then((result) =>
        getClickhouseData<
          Array<{
            p99_response_time_ms: string;
            p50_response_time_ms: string;
            p50_time_to_first_token_ms: string;
            p99_time_to_first_token_ms: string;
          }>
        >(result),
      )
      .then((v) => {
        const data = v[0] || {
          p50_time_to_first_token_ms: '0',
          p99_time_to_first_token_ms: '0',
          p50_response_time_ms: '0',
          p99_response_time_ms: '0',
        };
        return {
          p50_time_to_first_token_ns: (
            parseFloat(data.p50_time_to_first_token_ms) * 1000000
          ).toString(),
          p99_time_to_first_token_ns: (
            parseFloat(data.p99_time_to_first_token_ms) * 1000000
          ).toString(),
          p50_response_time_ms: data.p50_response_time_ms,
          p99_response_time_ms: data.p99_response_time_ms,
        };
      });
  }

  const [allMessagesDetails, toolErrorsDetails, ttfsDetails] =
    await Promise.all([
      getAllMessagesCount(),
      getToolErrorsCount(),
      getP50AndP99TimeToFirstToken(),
    ]);

  const totalMessageCount = parseInt(
    allMessagesDetails?.total_message_count || '0',
    10,
  );
  const errorMessageCount = parseInt(
    allMessagesDetails?.error_message_count || '0',
    10,
  );
  const toolErrorsCount = parseInt(
    toolErrorsDetails?.tool_error_count || '0',
    10,
  );

  const toolErrorRate = toolErrorsCount / (totalMessageCount || 1);
  const apiErrorRate = errorMessageCount / (totalMessageCount || 1);

  const p50TimeToFirstTokenNs = parseFloat(
    ttfsDetails?.p50_time_to_first_token_ns || '0',
  );
  const p99TimeToFirstTokenNs = parseFloat(
    ttfsDetails?.p99_time_to_first_token_ns || '0',
  );

  const p50ResponseTimeNs =
    parseFloat(ttfsDetails?.p50_response_time_ms || '0') * 1000000; // Convert ms to ns
  const p99ResponseTimeNs =
    parseFloat(ttfsDetails?.p99_response_time_ms || '0') * 1000000; // Convert ms to ns

  return {
    status: 200,
    body: {
      totalMessageCount: parseInt(
        allMessagesDetails?.total_message_count || '0',
        10,
      ),
      totalTokenCount: 0,
      tokenPerMessageMedian: 0,
      apiErrorRate: apiErrorRate,
      toolErrorRate: toolErrorRate,
      p50TimeToFirstTokenNs,
      p99TimeToFirstTokenNs,
      p50ResponseTimeNs,
      p99ResponseTimeNs,
    },
  };
}
