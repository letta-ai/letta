import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { attachFilterByBaseTemplateIdToOtels } from '$web/web-api/observability/utils/attachFilterByBaseTemplateIdToOtels/attachFilterByBaseTemplateIdToOtels';
import { attachFilterByBaseTemplateIdToMetricsCounters } from '$web/web-api/observability/utils/attachFilterByBaseTemplateIdToMetricsCounters/attachFilterByBaseTemplateIdToMetricsCounters';

type GetObservabilityOverviewRequest = ServerInferRequest<
  typeof contracts.observability.getObservabilityOverview
>;

type GetObservabilityOverviewResponse = ServerInferResponses<
  typeof contracts.observability.getObservabilityOverview
>;

const DEFAULT_SPAN_SEARCH = `(SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages/async')`;

export async function getObservabilityOverview(
  request: GetObservabilityOverviewRequest,
): Promise<GetObservabilityOverviewResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;

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
        avgToolLatencyNs: 0,
        p50ResponseTimeNs: 0,
        p99ResponseTimeNs: 0,
      },
    };
  }

  const user = await getUserWithActiveOrganizationIdOrThrow();

  function getP50P99ResponseTimes() {
    return client
      ?.query({
        query: `
        SELECT quantile(0.5)(toInt64OrNull(Events.Attributes[2]['duration_ms'])) * 1000000 as p50ResponseTimeNs, quantile(0.99)(toInt64OrNull(Events.Attributes[2]['duration_ms'])) * 1000000 as p99ResponseTimeNs, count() as sample_count
        FROM otel_traces
        WHERE TraceId IN (SELECT TraceId
                          FROM otel_traces
                          WHERE ParentSpanId = ''
                            AND (${DEFAULT_SPAN_SEARCH})
                            AND SpanAttributes['project.id'] =
            {projectId: String}
          AND SpanAttributes['organization.id'] = {organizationId: String}
          AND Timestamp >= {startDate: DateTime}
          AND Timestamp <= {endDate: DateTime}
          ${attachFilterByBaseTemplateIdToOtels(request.query)}
          )`,
        query_params: {
          projectId,
          organizationId: user.activeOrganizationId,
          startDate: Math.round(new Date(startDate).getTime() / 1000),
          endDate: Math.round(new Date(endDate).getTime() / 1000),
          baseTemplateId,
        },
        format: 'JSONEachRow',
      })
      .then((result) =>
        getClickhouseData<
          Array<{
            p50ResponseTimeNs: string;
            p99ResponseTimeNs: string;
            sample_count: string;
          }>
        >(result),
      )
      .then(
        (v) =>
          v[0] || {
            p50ResponseTimeNs: '0',
            p99ResponseTimeNs: '0',
            sample_count: '0',
          },
      );
  }

  function getAllMessagesCount() {
    return client
      ?.query({
        query: `
          SELECT SUM(value) as total_message_count
          FROM otel.letta_metrics_counters_5min_view
          WHERE metric_name = 'count_user_message'
            AND organization_id = {organizationId: String}
            AND project_id = {projectId: String}
            AND time_window >= toDateTime({startDate: UInt32})
            AND time_window <= toDateTime({endDate: UInt32})
            ${attachFilterByBaseTemplateIdToMetricsCounters(request.query)}
        `,
        query_params: {
          projectId,
          organizationId: user.activeOrganizationId,
          startDate: Math.round(new Date(startDate).getTime() / 1000),
          endDate: Math.round(new Date(endDate).getTime() / 1000),
          baseTemplateId,
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

  function getApiErrorRate() {
    return client
      ?.query({
        query: `
          SELECT
            SUM(CASE WHEN status_code != '200' THEN value ELSE 0 END) as error_count,
            SUM(CASE WHEN status_code = '200' THEN value ELSE 0 END) as success_count
          FROM otel.letta_metrics_counters_1hour_view
          WHERE metric_name = 'count_endpoint_requests'
            AND organization_id = {organizationId: String}
            AND project_id = {projectId: String}
            AND time_window >= toDateTime({startDate: UInt32})
            AND time_window <= toDateTime({endDate: UInt32})
            ${attachFilterByBaseTemplateIdToMetricsCounters(request.query)}
        `,
        query_params: {
          projectId,
          organizationId: user.activeOrganizationId,
          startDate: Math.round(new Date(startDate).getTime() / 1000),
          endDate: Math.round(new Date(endDate).getTime() / 1000),
          baseTemplateId,
        },
        format: 'JSONEachRow',
      })
      .then((result) =>
        getClickhouseData<
          Array<{
            success_count: string;
            error_count: string;
          }>
        >(result),
      )
      .then((v) => v[0] || { success_count: '0', error_count: '0' });
  }

  function getToolErrorsCount() {
    return client
      ?.query({
        query: `
          SELECT
            SUM(CASE WHEN tool_execution_success = 'false' THEN value ELSE 0 END) as tool_error_count,
            SUM(value) as total_tool_count
          FROM otel.letta_metrics_counters_5min_view
          WHERE metric_name = 'count_tool_execution'
            AND organization_id = {organizationId: String}
            AND project_id = {projectId: String}
            AND time_window >= toDateTime({startDate: UInt32})
            AND time_window <= toDateTime({endDate: UInt32})
            ${attachFilterByBaseTemplateIdToMetricsCounters(request.query)}
        `,
        query_params: {
          projectId,
          organizationId: user.activeOrganizationId,
          startDate: Math.round(new Date(startDate).getTime() / 1000),
          endDate: Math.round(new Date(endDate).getTime() / 1000),
          baseTemplateId,
        },
        format: 'JSONEachRow',
      })
      .then((result) =>
        getClickhouseData<
          Array<{ tool_error_count: string; total_tool_count: string }>
        >(result),
      )
      .then((v) => v[0] || { tool_error_count: '0', total_tool_count: '0' });
  }

  function getAverageToolLatency() {
    return client
      ?.query({
        query: `
          SELECT sum(count)                                                     as total_count,
                 CASE WHEN sum(count) > 0 THEN sum(sum) / sum(count) ELSE 0 END as avg_latency_ms
          FROM otel.letta_metrics_histograms_5min
          WHERE metric_name = 'hist_tool_execution_time_ms'
            AND organization_id = {organizationId: String}
            AND project_id = {projectId: String}
            AND time_window >= toDateTime({startDate: UInt32})
            AND time_window <= toDateTime({endDate: UInt32})
            AND tool_name != ''
            AND tool_name != 'send_message'
            ${attachFilterByBaseTemplateIdToMetricsCounters(request.query)}
        `,
        query_params: {
          projectId,
          organizationId: user.activeOrganizationId,
          startDate: Math.round(new Date(startDate).getTime() / 1000),
          endDate: Math.round(new Date(endDate).getTime() / 1000),
          baseTemplateId,
        },
        format: 'JSONEachRow',
      })
      .then((result) =>
        getClickhouseData<
          Array<{
            total_count: string;
            avg_latency_ms: string;
          }>
        >(result),
      )
      .then((v) => {
        const data = v[0] || {
          total_count: '0',
          avg_latency_ms: '0',
        };
        return {
          averageLatencyNs: parseInt(data.avg_latency_ms, 10) * 1_000_000, // Convert ms to ns
        };
      });
  }

  const [
    allMessagesDetails,
    apiErrorDetails,
    toolErrorsDetails,
    toolLatencyDetails,
    p50P99ResponseTimes,
  ] = await Promise.all([
    getAllMessagesCount(),
    getApiErrorRate(),
    getToolErrorsCount(),
    getAverageToolLatency(),
    getP50P99ResponseTimes(),
  ]);

  const toolErrorsCount = parseInt(
    toolErrorsDetails?.tool_error_count || '0',
    10,
  );
  const toolTotalCount = parseInt(
    toolErrorsDetails?.total_tool_count || '0',
    10,
  );
  const apiErrorCount = parseInt(apiErrorDetails?.error_count || '0', 10);
  const apiSuccessCount = parseInt(apiErrorDetails?.success_count || '0', 10);

  const toolErrorRate = toolErrorsCount / (toolTotalCount || 1);

  const apiErrorRate = apiErrorCount / (apiSuccessCount + apiErrorCount || 1);

  const avgToolLatencyNs = toolLatencyDetails?.averageLatencyNs || 0;

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
      avgToolLatencyNs: avgToolLatencyNs,
      p50ResponseTimeNs: parseInt(
        p50P99ResponseTimes?.p50ResponseTimeNs || '0',
        10,
      ),
      p99ResponseTimeNs: parseInt(
        p50P99ResponseTimes?.p99ResponseTimeNs || '0',
        10,
      ),
    },
  };
}
