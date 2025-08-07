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
import { getObservabilityCache, setObservabilityCache } from '../cacheHelpers';
import { attachFilterByBaseTemplateIdToOtels } from '../utils/attachFilterByBaseTemplateIdToOtels/attachFilterByBaseTemplateIdToOtels';
type GetObservabilityOverviewRequest = ServerInferRequest<
  typeof contracts.observability.getObservabilityOverview
>;

type GetObservabilityOverviewResponse = ServerInferResponses<
  typeof contracts.observability.getObservabilityOverview
>;

export async function getObservabilityOverview(
  request: GetObservabilityOverviewRequest,
): Promise<GetObservabilityOverviewResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getObservabilityOverview,
        200
      >
    >('observability_overview', {
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

  function getAllMessagesCount() {
    return client
      ?.query({
        query: `
      SELECT
        count() as total_message_count
      FROM otel_traces
      WHERE (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
             SpanName = 'POST /v1/agents/{agent_id}/messages' OR
             SpanName = 'POST /v1/agents/{agent_id}/messages/async')
        AND ParentSpanId = ''
        AND SpanAttributes['organization.id'] = {organizationId: String}
        AND SpanAttributes['project.id'] = {projectId: String}
        AND Timestamp >= {startDate: DateTime}
        AND Timestamp <= {endDate: DateTime}
        ${attachFilterByBaseTemplateIdToOtels(request.query)}
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

  function getToolErrorsCount() {
    return client
      ?.query({
        query: `
      SELECT
        count() as tool_error_count
      FROM otel_traces
      WHERE SpanName = 'agent_step'
        AND arrayExists(
          event -> event.Attributes['success'] = 'false',
          Events
        )
        AND Timestamp >= {startDate: DateTime}
        AND Timestamp <= {endDate: DateTime}
        AND TraceId IN (
          SELECT DISTINCT TraceId
          FROM otel_traces
          WHERE (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
                 SpanName = 'POST /v1/agents/{agent_id}/messages' OR
                 SpanName = 'POST /v1/agents/{agent_id}/messages/async')
            AND ParentSpanId = ''
            AND SpanAttributes['organization.id'] = {organizationId: String}
            AND SpanAttributes['project.id'] = {projectId: String}
            AND Timestamp >= {startDate: DateTime}
            AND Timestamp <= {endDate: DateTime}
            ${attachFilterByBaseTemplateIdToOtels(request.query)}
        )
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
        getClickhouseData<Array<{ tool_error_count: string }>>(result),
      )
      .then((v) => v[0]);
  }

  function getP50AndP99TimeToFirstToken() {
    return client
      ?.query({
        query: `
      SELECT
        quantile(0.50)(toFloat64OrNull(duration_ms)) AS p50_time_to_first_token_ms,
        quantile(0.99)(toFloat64OrNull(duration_ms)) AS p99_time_to_first_token_ms,
        0 as p50_response_time_ms,
        0 as p99_response_time_ms
      FROM (
        SELECT
          arrayFirst(event -> event.Name = 'time_to_first_token_ms', Events).Attributes['ttft_ms'] AS duration_ms
        FROM otel_traces
        WHERE SpanName = 'time_to_first_token'
          AND TraceId IN (
            SELECT DISTINCT TraceId
            FROM otel_traces
            WHERE (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages/async')
              AND SpanAttributes['project.id'] = {projectId: String}
              AND SpanAttributes['organization.id'] = {organizationId: String}
              AND ParentSpanId = ''
              AND Timestamp >= {startDate: DateTime}
              AND Timestamp <= {endDate: DateTime}
              ${attachFilterByBaseTemplateIdToOtels(request.query)}
          )
          AND arrayExists(
            event -> event.Name = 'time_to_first_token_ms',
            Events
          )
      )
      WHERE duration_ms IS NOT NULL
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

  const avgToolLatencyNs = 0; // This would need to be implemented based on actual tool latency data
  const p50ResponseTimeNs =
    parseFloat(ttfsDetails?.p50_response_time_ms || '0') * 1000000; // Convert ms to ns
  const p99ResponseTimeNs =
    parseFloat(ttfsDetails?.p99_response_time_ms || '0') * 1000000; // Convert ms to ns

  const responseBody = {
    totalMessageCount: parseInt(
      allMessagesDetails?.total_message_count || '0',
      10,
    ),
    totalTokenCount: 0,
    tokenPerMessageMedian: 0,
    apiErrorRate: apiErrorRate,
    toolErrorRate: toolErrorRate,
    avgToolLatencyNs,
    p50ResponseTimeNs,
    p99ResponseTimeNs,
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'observability_overview',
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
    console.error('Failed to cache observability overview:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
