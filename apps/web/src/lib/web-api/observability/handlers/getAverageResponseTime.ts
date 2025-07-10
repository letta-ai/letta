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

type GetAverageResponseTimeRequest = ServerInferRequest<
  typeof contracts.observability.getAverageResponseTime
>;

type GetAverageResponseTimeResponse = ServerInferResponses<
  typeof contracts.observability.getAverageResponseTime
>;

export async function getAverageResponseTime(
  request: GetAverageResponseTimeRequest,
): Promise<GetAverageResponseTimeResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getAverageResponseTime,
        200
      >
    >('average_response_time', {
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

  const response = await client.query({
    query: `
      SELECT toDate(Timestamp) as date,
      avg(toInt64OrNull(Events.Attributes[2]['duration_ms'])) * 1000000 as p50ResponseTimeNs,
      quantile(0.99)(toInt64OrNull(Events.Attributes[2]['duration_ms'])) * 1000000 as p99ResponseTimeNs,
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
          ${attachFilterByBaseTemplateIdToOtels(request.query)}
        )
      GROUP BY toDate(Timestamp)
      ORDER BY date;
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      projectId,
      organizationId: user.activeOrganizationId,
      baseTemplateId,
    },
    format: 'JSONEachRow',
  });

  const result = await getClickhouseData<
    Array<{
      date: string;
      p50ResponseTimeNs: number;
      p99ResponseTimeNs: number;
      sample_count: number;
    }>
  >(response);

  const responseBody = {
    items: result.map((item) => ({
      date: item.date,
      p50ResponseTimeNs: item.p50ResponseTimeNs,
      p99ResponseTimeNs: item.p99ResponseTimeNs,
      sampleCount: item.sample_count,
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'average_response_time',
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
    console.error('Failed to cache average response time:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
