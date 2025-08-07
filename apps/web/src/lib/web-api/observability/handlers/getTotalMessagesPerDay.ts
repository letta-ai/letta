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
import { getClickhouseStepInterval } from '../utils/getClickhouseStepInterval';

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

  const stepInterval = getClickhouseStepInterval(granularity);

  // Handle ClickHouse WITH FILL type compatibility:
  // - Date columns (from toDate()) require 'YYYY-MM-DD' string literals
  // - DateTime columns (from toDateTime(), toStartOfHour(), etc.) require toDateTime(timestamp)
  // This prevents "Incompatible types of WITH FILL expression values" errors
  const isDateColumn = granularity.clickhouseDateFormat.includes('toDate(');

  let fromValue, toValue;
  if (isDateColumn) {
    // For Date columns: use numeric date values (days since epoch)
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    fromValue = Math.floor(startDateObj.getTime() / (1000 * 60 * 60 * 24));
    toValue = Math.floor(endDateObj.getTime() / (1000 * 60 * 60 * 24));
  } else {
    // For DateTime columns: use unix timestamps
    fromValue = Math.round(new Date(startDate).getTime() / 1000);
    toValue = Math.round(new Date(endDate).getTime() / 1000);
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
      ORDER BY time_interval ASC
      WITH FILL
        FROM {fromValue: ${isDateColumn ? 'UInt32' : 'UInt32'}}
        TO {toValue: ${isDateColumn ? 'UInt32' : 'UInt32'}}
        STEP INTERVAL ${stepInterval}
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      fromValue,
      toValue,
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
    items: response
      .map((item) => ({
        date: item.time_interval,
        totalMessages: parseInt(item.total_messages, 10),
      }))
      .reverse(), // Reverse to maintain DESC order for frontend compatibility
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
