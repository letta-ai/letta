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
  const { projectId, startTimeUnix, endTimeUnix } = request.query;

  const response = await getTimeToFirstTokenAverages({
    projectId,
    startUnixTimestamp: startTimeUnix,
    endUnixTimestamp: endTimeUnix,
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
  const { projectId, startTimeUnix, endTimeUnix } = request.query;

  const response = await getTotalResponseTimeAverages({
    projectId,
    startUnixTimestamp: startTimeUnix,
    endUnixTimestamp: endTimeUnix,
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
  const { projectId, startTimeUnix, endTimeUnix } = request.query;

  const client = getClickhouseClient();

  if (!client) {
    return {
      status: 500,
      body: {
        items: [],
      },
    };
  }

  const result = await client.query({
    query: `
      SELECT
        toDate(Timestamp) as date,
        count() as total_messages
      FROM otel_traces
      WHERE SpanName = 'POST /v1/agents/{agent_id}/messages/stream'
        AND SpanAttributes['project.id'] = '${projectId}'
        AND Timestamp >= toDateTime64(${startTimeUnix}, 9)
        AND Timestamp <= toDateTime64(${endTimeUnix}, 9)
      GROUP BY toDate(Timestamp)
      ORDER BY date;
    `,
    format: 'JSONEachRow',
  });

  const response = await getClickhouseData<
    Array<{
      date: string;
      total_messages: number;
    }>
  >(result);

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.date,
        totalMessages: item.total_messages,
      })),
    },
  };
}

export const observabilityRouter = {
  getTimeToFirstTokenMetrics,
  getAverageResponseTime,
  getTotalMessagesPerDay,
};
