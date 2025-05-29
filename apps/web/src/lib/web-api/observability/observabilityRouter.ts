import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getTimeToFirstTokenAverages,
  getTotalResponseTimeAverages,
} from '@letta-cloud/service-clickhouse';
import { getClickhouseData } from '@letta-cloud/service-clickhouse';

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
        AND Timestamp >= toDateTime64(${new Date(startDate).getTime() / 1000}, 9)
        AND Timestamp <= toDateTime64(${new Date(endDate).getTime() / 1000}, 9)
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
        date,
        countIf(is_first_usage = false) as returning_active_agents_count,
        countIf(is_first_usage = true) as new_active_agents_count,
        count() as total_active_agents_count
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

export const observabilityRouter = {
  getTimeToFirstTokenMetrics,
  getAverageResponseTime,
  getTotalMessagesPerDay,
  getActiveAgentsPerDay,
};
