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
import { attachFilterByBaseTemplateIdToMetricsCounters } from '../utils/attachFilterByBaseTemplateIdToMetricsCounters/attachFilterByBaseTemplateIdToMetricsCounters';
import { getObservabilityCache, setObservabilityCache } from '../cacheHelpers';

type GetActiveAgentsPerDayRequest = ServerInferRequest<
  typeof contracts.observability.getActiveAgentsPerDay
>;

type GetActiveAgentsPerDayResponse = ServerInferResponses<
  typeof contracts.observability.getActiveAgentsPerDay
>;

export async function getActiveAgentsPerDay(
  request: GetActiveAgentsPerDayRequest,
): Promise<GetActiveAgentsPerDayResponse> {
  const { projectId, startDate, endDate, baseTemplateId, timeRange } =
    request.query;

  // Check cache first
  try {
    const cachedBody = await getObservabilityCache<
      ServerInferResponseBody<
        typeof contracts.observability.getActiveAgentsPerDay,
        200
      >
    >('active_agents_per_day', {
      projectId,
      startDate,
      endDate,
      baseTemplateId,
      timeRange,
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
        returningActiveAgents: [],
        newActiveAgents: [],
      },
    };
  }

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
        ${attachFilterByBaseTemplateIdToMetricsCounters(request.query)}
      GROUP BY date
      ORDER BY date;
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      projectId,
      baseTemplateId,
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

  const responseBody = {
    returningActiveAgents: response.map((item) => ({
      date: item.date,
      activeAgents: parseInt(item.returning_active_agents_count, 10),
    })),
    newActiveAgents: response.map((item) => ({
      date: item.date,
      activeAgents: parseInt(item.new_active_agents_count, 10),
    })),
  };

  // Cache the result
  try {
    await setObservabilityCache(
      'active_agents_per_day',
      { projectId, startDate, endDate, baseTemplateId, timeRange },
      responseBody,
    );
  } catch (error) {
    // If caching fails, still return the result
    console.error('Failed to cache active agents per day:', error);
  }

  return {
    status: 200 as const,
    body: responseBody,
  };
}
