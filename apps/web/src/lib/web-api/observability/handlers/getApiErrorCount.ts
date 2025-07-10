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
import { attachFilterByBaseTemplateIdToMetricsCounters } from '$web/web-api/observability/utils/attachFilterByBaseTemplateIdToMetricsCounters/attachFilterByBaseTemplateIdToMetricsCounters';
import { getObservabilityCache, setObservabilityCache } from '../cacheHelpers';

type GetApiErrorCountRequest = ServerInferRequest<
  typeof contracts.observability.getApiErrorCount
>;

type GetApiErrorCountResponse = ServerInferResponses<
  typeof contracts.observability.getApiErrorCount
>;

export async function getApiErrorCount(
  request: GetApiErrorCountRequest,
): Promise<GetApiErrorCountResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

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
        toDate(time_window) as date,
        SUM(CASE WHEN status_code != '200' THEN value ELSE 0 END) as error_count
      FROM otel.letta_metrics_counters_1hour_view
      WHERE metric_name = 'count_endpoint_requests'
        AND organization_id = {organizationId: String}
        AND project_id = {projectId: String}
        AND time_window >= toDateTime({startDate: UInt32})
        AND time_window <= toDateTime({endDate: UInt32})
        ${attachFilterByBaseTemplateIdToMetricsCounters(request.query)}
      GROUP BY toDate(time_window)
      ORDER BY date DESC
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
      date: string;
      error_count: string;
    }>
  >(result);

  const responseBody = {
    items: response.map((item) => ({
      date: item.date,
      errorCount: parseInt(item.error_count, 10),
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
