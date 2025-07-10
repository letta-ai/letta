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
import { attachFilterByBaseTemplateIdToOtels } from '$web/web-api/observability/utils/attachFilterByBaseTemplateIdToOtels/attachFilterByBaseTemplateIdToOtels';
import { getObservabilityCache, setObservabilityCache } from '../cacheHelpers';

const DEFAULT_SPAN_SEARCH = `(SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages/async')`;

type GetToolErrorMessagesRequest = ServerInferRequest<
  typeof contracts.observability.getToolErrorMessages
>;

type GetToolErrorMessagesResponse = ServerInferResponses<
  typeof contracts.observability.getToolErrorMessages
>;

export async function getToolErrorMessages(
  request: GetToolErrorMessagesRequest,
): Promise<GetToolErrorMessagesResponse> {
  const {
    projectId,
    startDate,
    endDate,
    functionName,
    limit = 10,
    baseTemplateId,
    offset = 0,
  } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getToolErrorMessages,
        200
      >
    >('tool_error_messages', {
      projectId,
      startDate,
      endDate,
      functionName,
      limit,
      offset,
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
        items: [],
        totalCount: 0,
      },
    };
  }

  const client = getClickhouseClient();

  if (!client) {
    return {
      status: 200,
      body: {
        items: [],
        totalCount: 0,
      },
    };
  }

  let functionNameCondition = '';
  if (functionName) {
    functionNameCondition = `AND arrayExists(
      event -> event.Attributes['function.name'] = {functionName: String},
      Events
    )`;
  }

  const countQuery = await client.query({
    query: `
      SELECT count() as total_count
      FROM otel_traces
      WHERE SpanName = 'agent_step'
        AND arrayExists(
          event -> event.Attributes['success'] = 'false',
          Events
        )
        ${functionNameCondition}
        AND Timestamp >= {startDate: DateTime}
        AND Timestamp <= {endDate: DateTime}
        AND TraceId IN (
          SELECT DISTINCT TraceId
          FROM otel_traces
          WHERE (${DEFAULT_SPAN_SEARCH})
          AND ParentSpanId = ''
          AND SpanAttributes['project.id'] = {projectId: String}
          AND SpanAttributes['organization.id'] = {organizationId: String}
          ${attachFilterByBaseTemplateIdToOtels(request.query)}
          AND Timestamp >= {startDate: DateTime}
          AND Timestamp <= {endDate: DateTime}
        )
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      organizationId: user.activeOrganizationId,
      projectId,
      baseTemplateId,
      ...(functionName && { functionName }),
    },
    format: 'JSONEachRow',
  });

  const countResult =
    await getClickhouseData<Array<{ total_count: string }>>(countQuery);
  const totalCount = parseInt(countResult[0]?.total_count || '0', 10);

  interface ToolErrorResponse {
    TraceId: string;
    SpanId: string;
    Timestamp: string;
    SpanAttributes: Record<string, any>;
    Events: Array<{
      Name: string;
      Timestamp: number;
      Attributes: Record<string, any>;
    }>;
  }

  const result = await client.query({
    query: `
      SELECT
        TraceId,
        SpanId,
        Timestamp,
        SpanAttributes,
        Events
      FROM otel_traces
      WHERE SpanName = 'agent_step'
        AND arrayExists(
          event -> event.Attributes['success'] = 'false',
          Events
        )
        ${functionNameCondition}
        AND Timestamp >= {startDate: DateTime}
        AND Timestamp <= {endDate: DateTime}
        AND TraceId IN (
          SELECT DISTINCT TraceId
          FROM otel_traces
          WHERE (${DEFAULT_SPAN_SEARCH})
          AND ParentSpanId = ''
          AND SpanAttributes['project.id'] = {projectId: String}
          AND SpanAttributes['organization.id'] = {organizationId: String}
          AND Timestamp >= {startDate: DateTime}
          AND Timestamp <= {endDate: DateTime}
        )
      ORDER BY Timestamp DESC
      LIMIT {limit: UInt32}
      OFFSET {offset: UInt32}
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      organizationId: user.activeOrganizationId,
      projectId,
      limit,
      offset,
      ...(functionName && { functionName }),
    },
    format: 'JSONEachRow',
  });

  const response = await getClickhouseData<ToolErrorResponse[]>(result);

  interface ParentSpanResponse {
    TraceId: string;
    SpanAttributes: Record<string, any>;
    user_message?: string;
    agent_message?: string;
  }

  const traceIds = response.map((item) => item.TraceId);
  let parentSpans: ParentSpanResponse[] = [];

  if (traceIds.length > 0) {
    const parentSpanQuery = await client.query({
      query: `
        SELECT
          TraceId,
          SpanAttributes,
          SpanAttributes['user_message'] as user_message,
          SpanAttributes['agent_message'] as agent_message
        FROM otel_traces
        WHERE TraceId IN ({traceIds: Array(String)})
          AND (${DEFAULT_SPAN_SEARCH})
          AND ParentSpanId = ''
      `,
      query_params: {
        traceIds,
      },
      format: 'JSONEachRow',
    });

    parentSpans =
      await getClickhouseData<ParentSpanResponse[]>(parentSpanQuery);
  }

  const parentSpanMap = new Map<string, ParentSpanResponse>();
  parentSpans.forEach((span) => {
    parentSpanMap.set(span.TraceId, span);
  });

  const items = response.map((item) => {
    const parentSpan = parentSpanMap.get(item.TraceId);
    const errorEvent = item.Events.find(
      (event) => event.Attributes['success'] === 'false',
    );
    const functionName = errorEvent?.Attributes['function.name'] || 'Unknown';
    const errorMessage = errorEvent?.Attributes['error'] || 'Unknown error';

    return {
      traceId: item.TraceId,
      agentId:
        parentSpan?.SpanAttributes['agent.id'] ||
        item.SpanAttributes['agent.id'] ||
        '',
      functionName,
      errorMessage,
      userMessage: parentSpan?.user_message || '',
      agentMessage: parentSpan?.agent_message || '',
      timestamp: new Date(item.Timestamp).toISOString(),
    };
  });

  const responseBody = {
    items,
    totalCount,
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'tool_error_messages',
      {
        projectId,
        startDate,
        endDate,
        functionName,
        limit,
        offset,
        baseTemplateId,
        organizationId: user.activeOrganizationId,
      },
      responseBody,
    );
  } catch (error) {
    // If caching fails, still return the result
    console.error('Failed to cache tool error messages:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
