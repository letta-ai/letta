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
import { getTimeConfig } from '$web/client/hooks/useObservabilityContext/timeConfig';

type GetApiErrorCountRequest = ServerInferRequest<
  typeof contracts.observability.getApiErrorCount
>;

type GetApiErrorCountResponse = ServerInferResponses<
  typeof contracts.observability.getApiErrorCount
>;

export async function getApiErrorCount(
  request: GetApiErrorCountRequest,
): Promise<GetApiErrorCountResponse> {
  const { projectId, startDate, endDate, baseTemplateId, timeRange } =
    request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Get time granularity configuration
  const granularity = getTimeConfig(timeRange || '30d');

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getApiErrorCount,
        200
      >
    >('api_error_count', {
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
        SUM(CASE WHEN StatusCode != 'STATUS_CODE_OK' THEN 1 ELSE 0 END) as api_error_count
      FROM otel_traces
      PREWHERE Timestamp >= {startDate: DateTime} AND Timestamp <= {endDate: DateTime}
      WHERE (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
             SpanName = 'POST /v1/agents/{agent_id}/messages' OR
             SpanName = 'POST /v1/agents/{agent_id}/messages/async')
        AND ParentSpanId = ''
        AND SpanAttributes['organization.id'] = {organizationId: String}
        AND SpanAttributes['project.id'] = {projectId: String}
        ${attachFilterByBaseTemplateIdToOtels(request.query)}
      GROUP BY time_interval
      ORDER BY time_interval DESC
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      organizationId: user.activeOrganizationId,
      projectId,
      baseTemplateId,
    },
    format: 'JSONEachRow',
  });

  const response = await getClickhouseData<
    Array<{
      time_interval: string;
      api_error_count: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.time_interval,
      apiErrorCount: parseInt(item.api_error_count, 10),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'api_error_count',
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
    console.error('Failed to cache API error count:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
