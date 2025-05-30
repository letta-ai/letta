import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getTimeToFirstTokenAverages,
  getTotalResponseTimeAverages,
} from '@letta-cloud/service-clickhouse';
import { getClickhouseData } from '@letta-cloud/service-clickhouse';
import type { MessageCreate } from '@letta-cloud/sdk-core';

type GetTimeToFirstTokenMetricsRequest = ServerInferRequest<
  typeof contracts.observability.getTimeToFirstTokenMetrics
>;

type GetTimeToFirstTokenMetricsResponse = ServerInferResponses<
  typeof contracts.observability.getTimeToFirstTokenMetrics
>;

async function getTimeToFirstTokenMetrics(
  request: GetTimeToFirstTokenMetricsRequest,
): Promise<GetTimeToFirstTokenMetricsResponse> {
  const { projectId, startDate, endDate } = request.query;

  const response = await getTimeToFirstTokenAverages({
    projectId,
    startUnixTimestamp: new Date(startDate).getTime() / 1000,
    endUnixTimestamp: new Date(endDate).getTime() / 1000,
  });

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.date,
        averageTimeToFirstTokenMs: item.avg_time_to_first_token_ms,
        sampleCount: item.sample_count,
      })),
    },
  };
}

type GetAverageResponseTimeRequest = ServerInferRequest<
  typeof contracts.observability.getAverageResponseTime
>;
type GetAverageResponseTimeResponse = ServerInferResponses<
  typeof contracts.observability.getAverageResponseTime
>;

async function getAverageResponseTime(
  request: GetAverageResponseTimeRequest,
): Promise<GetAverageResponseTimeResponse> {
  const { projectId, startDate, endDate } = request.query;

  const response = await getTotalResponseTimeAverages({
    projectId,
    startUnixTimestamp: new Date(startDate).getTime() / 1000,
    endUnixTimestamp: new Date(endDate).getTime() / 1000,
  });

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.date,
        averageResponseTimeMs: item.avg_total_response_time_ms,
        sampleCount: item.sample_count,
      })),
    },
  };
}

type GetTotalMessagesPerDayRequest = ServerInferRequest<
  typeof contracts.observability.getTotalMessagesPerDay
>;

type GetTotalMessagesPerDayResponse = ServerInferResponses<
  typeof contracts.observability.getTotalMessagesPerDay
>;

async function getTotalMessagesPerDay(
  request: GetTotalMessagesPerDayRequest,
): Promise<GetTotalMessagesPerDayResponse> {
  const { projectId, startDate, endDate } = request.query;

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
      SELECT toDate(Timestamp) as date,
        count() as total_messages
      FROM otel_traces
      WHERE SpanName = 'POST /v1/agents/{agent_id}/messages/stream'
        AND SpanAttributes['project.id'] = '${projectId}'
        AND Timestamp >= toDateTime64(${new Date(startDate).getTime() / 1000}
          , 9)
        AND Timestamp <= toDateTime64(${new Date(endDate).getTime() / 1000}
          , 9)
      GROUP BY toDate(Timestamp)
      ORDER BY date;
    `,
    format: 'JSONEachRow',
  });

  const response = await getClickhouseData<
    Array<{
      date: string;
      total_messages: string;
    }>
  >(result);

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.date,
        totalMessages: parseInt(item.total_messages, 10), // Convert string to number
      })),
    },
  };
}

type GetActiveAgentsPerDayRequest = ServerInferRequest<
  typeof contracts.observability.getActiveAgentsPerDay
>;

type GetActiveAgentsPerDayResponse = ServerInferResponses<
  typeof contracts.observability.getActiveAgentsPerDay
>;

async function getActiveAgentsPerDay(
  request: GetActiveAgentsPerDayRequest,
): Promise<GetActiveAgentsPerDayResponse> {
  const { projectId, startDate, endDate } = request.query;

  const client = getClickhouseClient('default');

  if (!client) {
    return {
      status: 200,
      body: {
        returningActiveAgents: [],
        newActiveAgents: [],
      },
    };
  }

  const result = await client.query({
    query: `
      SELECT
        date, countIf(is_first_usage = false) as returning_active_agents_count, countIf(is_first_usage = true) as new_active_agents_count, count () as total_active_agents_count
      FROM agent_usage
      WHERE messaged_at >= {startDate: DateTime}
        AND messaged_at <= {endDate: DateTime}
        AND project_id = {projectId: String}
      GROUP BY date
      ORDER BY date;
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      projectId,
    },
    format: 'JSONEachRow',
  });

  const response = await getClickhouseData<
    Array<{
      date: string;
      returning_active_agents_count: string;
      new_active_agents_count: string;
    }>
  >(result);

  return {
    status: 200,
    body: {
      returningActiveAgents: response.map((item) => ({
        date: item.date,
        activeAgents: parseInt(item.returning_active_agents_count, 10),
      })),
      newActiveAgents: response.map((item) => ({
        date: item.date,
        activeAgents: parseInt(item.new_active_agents_count, 10),
      })),
    },
  };
}

type GetTimeToFirstTokenMessagesRequest = ServerInferRequest<
  typeof contracts.observability.getTimeToFirstTokenMessages
>;

type GetTimeToFirstTokenMessagesResponse = ServerInferResponses<
  typeof contracts.observability.getTimeToFirstTokenMessages
>;

async function getTimeToFirstTokenMessages(
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
              AND Timestamp >= {startDate: DateTime}
              AND Timestamp <= {endDate: DateTime}
              LIMIT {limit: Int64}
            OFFSET {offset: Int64}`,
    query_params: {
      projectId,
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
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

export const observabilityRouter = {
  getTimeToFirstTokenMetrics,
  getTimeToFirstTokenMessages,
  getAverageResponseTime,
  getTotalMessagesPerDay,
  getActiveAgentsPerDay,
};
