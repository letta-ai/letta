import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getTotalResponseTimeAverages,
} from '@letta-cloud/service-clickhouse';
import { getClickhouseData } from '@letta-cloud/service-clickhouse';
import type { MessageCreate } from '@letta-cloud/sdk-core';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';

const DEFAULT_SPAN_SEARCH = `(SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages/async')`;

type GetToolErrorsMetricsRequest = ServerInferRequest<
  typeof contracts.observability.getToolErrorsMetrics
>;

type GetToolErrorsMetricsResponse = ServerInferResponses<
  typeof contracts.observability.getToolErrorsMetrics
>;

async function getToolErrorsMetrics(
  request: GetToolErrorsMetricsRequest,
): Promise<GetToolErrorsMetricsResponse> {
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
      SELECT toDate(Timestamp) as error_date,
             count()           as error_count
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
        WHERE (${DEFAULT_SPAN_SEARCH})
        AND ParentSpanId = ''
        AND SpanAttributes['project.id'] = {projectId: String}
        AND Timestamp >= {startDate: DateTime}
        AND Timestamp <= {endDate: DateTime}
        )
      GROUP BY toDate(Timestamp)
      ORDER BY error_date DESC
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
      error_date: string;
      error_count: string;
    }>
  >(result);

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.error_date,
        errorCount: parseInt(item.error_count, 10), // Convert string to number
      })),
    },
  };
}

type GetToolErrorMessagesRequest = ServerInferRequest<
  typeof contracts.observability.getToolErrorMessages
>;

type GetToolErrorMessagesResponse = ServerInferResponses<
  typeof contracts.observability.getToolErrorMessages
>;

async function getToolErrorMessages(
  request: GetToolErrorMessagesRequest,
): Promise<GetToolErrorMessagesResponse> {
  const {
    projectId,
    startDate,
    endDate,
    limit = 10,
    offset = 0,
  } = request.query;
  const user = await getUserWithActiveOrganizationIdOrThrow();

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

  const data = await client.query({
    query: `
      SELECT TraceId,
             SpanAttributes,
             ParentSpanId,
             Events, Timestamp as created_at
      FROM otel_traces
      WHERE SpanName = 'agent_step'
        AND arrayExists(
        event -> event.Attributes['success'] = 'false'
          , Events
        )
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
      ORDER BY created_at DESC
        LIMIT {limit: Int64}
      OFFSET {offset: Int64}
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      projectId,
      organizationId: user.activeOrganizationId,
      limit: limit + 1, // Fetch one extra item to check for next page
      offset,
    },
    format: 'JSONEachRow',
  });

  type ToolErrorResponse = Array<{
    TraceId: string;
    ParentSpanId: string;
    created_at: string;
    SpanAttributes: {
      'agent.id': string;
    };
    Events: Array<{
      Name: 'tool_execution_completed';
      Attributes: {
        tool_name: string;
      };
    }>;
  }>;

  const response = await getClickhouseData<ToolErrorResponse>(data);

  const parentSpans = await client.query({
    query: `SELECT *
            FROM otel_traces
            WHERE TraceId IN ({traceIds: Array(String)})
              AND ParentSpanId = ''
    `,
    query_params: {
      traceIds: response.map((item) => item.TraceId),
    },
    format: 'JSONEachRow',
  });

  type ParentSpanResponse = Array<{
    SpanAttributes: {
      'agent.id': string;
    };
    TraceId: string;
  }>;

  const parentSpansData =
    await getClickhouseData<ParentSpanResponse>(parentSpans);

  const parentSpanMap = new Map<string, { agentId: string; traceId: string }>();

  parentSpansData.forEach((span) => {
    parentSpanMap.set(span.TraceId, {
      agentId: span.SpanAttributes['agent.id'],
      traceId: span.TraceId,
    });
  });

  const items = response.map((item) => {
    const toolName =
      item.Events.find((event) => event.Name === 'tool_execution_completed')
        ?.Attributes?.tool_name || 'Unknown Tool';

    return {
      traceId: item.TraceId,
      agentId: parentSpanMap.get(item.TraceId)?.agentId || '',
      createdAt: new Date(item.created_at).toISOString(),
      toolName,
    };
  });

  const hasNextPage = response.length > limit;

  return {
    status: 200,
    body: {
      items: items.slice(0, limit), // Return only the requested number of items
      hasNextPage,
    },
  };
}

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
      SELECT toDate(Timestamp) as date,
    avg(Duration) as avg_time_to_first_token_ns,
    avg(Duration) / 1000000 as avg_time_to_first_token_ms,
    count() as sample_count
      FROM otel_traces
      WHERE TraceId IN (
        SELECT TraceId
        FROM otel_traces
        WHERE ParentSpanId = ''
        AND (${DEFAULT_SPAN_SEARCH})
        AND SpanAttributes['project.id'] = {projectId: String}
        AND SpanAttributes['organization.id'] = {organizationId: String}
        AND Timestamp >= {startDate: DateTime}
        AND Timestamp <= {endDate: DateTime}
        )
        AND SpanName = 'time_to_first_token'
      GROUP BY toDate(Timestamp)
      ORDER BY date;
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
    avg_time_to_first_token_ns: number;
    avg_time_to_first_token_ms: number;
    sample_count: number;
  }

  const response = await getClickhouseData<QueryResult[]>(result);

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

  const user = await getUserWithActiveOrganizationIdOrThrow();

  const result = await client.query({
    query: `
      SELECT toDate(Timestamp) as date,
        count() as total_messages
      FROM otel_traces
      WHERE (${DEFAULT_SPAN_SEARCH})
        AND SpanAttributes['project.id'] = {projectId: String}
        AND SpanAttributes['organization.id'] = {organizationId: String}
        AND Timestamp >= {startDate: DateTime}
        AND Timestamp <= {endDate: DateTime}
      GROUP BY toDate(Timestamp)
      ORDER BY date;
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      projectId,
      organizationId: user.activeOrganizationId,
    },
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

export const observabilityRouter = {
  getTimeToFirstTokenMetrics,
  getTimeToFirstTokenMessages,
  getAverageResponseTime,
  getTotalMessagesPerDay,
  getActiveAgentsPerDay,
  getToolErrorsMetrics,
  getToolErrorMessages,
};
