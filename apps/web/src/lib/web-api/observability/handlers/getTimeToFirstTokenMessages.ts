import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import type { MessageCreate } from '@letta-cloud/sdk-core';

type GetTimeToFirstTokenMessagesRequest = ServerInferRequest<
  typeof contracts.observability.getTimeToFirstTokenMessages
>;

type GetTimeToFirstTokenMessagesResponse = ServerInferResponses<
  typeof contracts.observability.getTimeToFirstTokenMessages
>;

export async function getTimeToFirstTokenMessages(
  request: GetTimeToFirstTokenMessagesRequest,
): Promise<GetTimeToFirstTokenMessagesResponse> {
  const {
    projectId,
    startDate,
    endDate,
    limit = 10,
    offset = 0,
  } = request.query;

  const client = getClickhouseClient();
  const user = await getUserWithActiveOrganizationIdOrThrow();

  if (!client) {
    return {
      status: 200,
      body: {
        items: [],
        hasNextPage: false,
      },
    };
  }

  const preResults = await client.query({
    query: `SELECT *
            FROM otel_traces
            WHERE ParentSpanId = ''
              AND (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages/async')
              AND SpanAttributes['project.id'] = {projectId: String}
              AND SpanAttributes['organization.id'] = {organizationId: String}
              AND Timestamp >= {startDate: DateTime}
              AND Timestamp <= {endDate: DateTime}
              LIMIT {limit: Int64}
            OFFSET {offset: Int64}`,
    query_params: {
      projectId,
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      organizationId: user.activeOrganizationId,
      limit: limit + 1,
      offset,
    },
    format: 'JSONEachRow',
  });

  const parentSpansMax = await getClickhouseData<
    Array<{
      TraceId: string;
      SpanName: string;
      SpanId: string;
      Timestamp: string;
      Duration: number;
      SpanAttributes: {
        'agent.id': string;
        'http.request.body.messages': string;
      };
    }>
  >(preResults);

  const parentSpans = parentSpansMax.slice(0, limit);
  const hasNextPage = parentSpansMax.length > limit;

  const parentSpanIds = parentSpans.map((span) => span.TraceId);

  const childSpansResult = await client.query({
    query: `SELECT *
            FROM otel_traces
            WHERE TraceId IN ({parentSpanIds: Array(String)})
              AND SpanName = 'time_to_first_token'
    `,
    query_params: {
      parentSpanIds,
    },
    format: 'JSONEachRow',
  });

  interface ChildSpanItem {
    TraceId: string;
    SpanName: string;
    Timestamp: string;
    ParentSpanId: string;
    Duration: number;
  }

  const childSpans = await getClickhouseData<ChildSpanItem[]>(childSpansResult);

  const childSpanMap = new Map<string, ChildSpanItem>();

  childSpans.forEach((span) => {
    if (!childSpanMap.has(span.ParentSpanId)) {
      childSpanMap.set(span.ParentSpanId, span);
    }
  });

  const items = parentSpans.map((item) => {
    const childSpan = childSpanMap.get(item.SpanId);

    let messages: MessageCreate[] = [];

    try {
      function fixStringifiedJSON(str: string): string {
        // the string is using singlequotes for strings, we need to replace them with double quotes
        return str.replace(/'/g, '"');
      }

      messages = JSON.parse(
        fixStringifiedJSON(item.SpanAttributes['http.request.body.messages']),
      );
    } catch (_e) {
      //
    }

    return {
      agentId: item.SpanAttributes['agent.id'],
      traceId: item.TraceId,
      createdAt: new Date(item.Timestamp).toISOString(),
      timeToFirstTokenNs: childSpan ? childSpan.Duration : null,
      messages: messages,
    };
  });

  return {
    status: 200,
    body: {
      items,
      hasNextPage,
    },
  };
}
