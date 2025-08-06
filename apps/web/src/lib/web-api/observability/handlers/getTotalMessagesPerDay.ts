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
import { attachFilterByBaseTemplateIdToOtels } from '$web/web-api/observability/utils/attachFilterByBaseTemplateIdToOtels/attachFilterByBaseTemplateIdToOtels';
import { getTimeConfig } from '$web/client/hooks/useObservabilityContext/timeConfig';

type GetTotalMessagesPerDayRequest = ServerInferRequest<
  typeof contracts.observability.getTotalMessagesPerDay
>;

type GetTotalMessagesPerDayResponse = ServerInferResponses<
  typeof contracts.observability.getTotalMessagesPerDay
>;

export async function getTotalMessagesPerDay(
  request: GetTotalMessagesPerDayRequest,
): Promise<GetTotalMessagesPerDayResponse> {
  const { projectId, startDate, endDate, baseTemplateId, timeRange } =
    request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Get time granularity configuration
  const granularity = getTimeConfig(timeRange || '30d');

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getTotalMessagesPerDay,
        200
      >
    >('total_messages_per_day', {
      projectId,
      startDate,
      endDate,
      baseTemplateId,
      timeRange,
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
      },
    };
  }

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
        ${granularity.clickhouseDateFormat} as time_interval,
        count() as total_messages
      FROM otel_traces
      PREWHERE Timestamp >= {startDate: DateTime} AND Timestamp <= {endDate: DateTime}
      WHERE SpanName IN ('POST /v1/agents/{agent_id}/messages/stream', 'POST /v1/agents/{agent_id}/messages', 'POST /v1/agents/{agent_id}/messages/async')
        AND ParentSpanId = ''
        AND SpanAttributes['project.id'] = {projectId: String}
        AND SpanAttributes['organization.id'] = {organizationId: String}
        ${attachFilterByBaseTemplateIdToOtels(request.query)}
      GROUP BY time_interval
      ORDER BY time_interval DESC
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      baseTemplateId,
      projectId,
      organizationId: user.activeOrganizationId,
    },
    format: 'JSONEachRow',
  });

  const response = await getClickhouseData<
    Array<{
      time_interval: string;
      total_messages: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.time_interval,
      totalMessages: parseInt(item.total_messages, 10),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'total_messages_per_day',
      {
        projectId,
        startDate,
        endDate,
        baseTemplateId,
        timeRange,
        organizationId: user.activeOrganizationId,
      },
      responseBody,
    );
  } catch (error) {
    // If caching fails, still return the result
    console.error('Failed to cache total messages per day:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
