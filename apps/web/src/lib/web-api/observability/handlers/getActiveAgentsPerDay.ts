import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';

type GetActiveAgentsPerDayRequest = ServerInferRequest<
  typeof contracts.observability.getActiveAgentsPerDay
>;

type GetActiveAgentsPerDayResponse = ServerInferResponses<
  typeof contracts.observability.getActiveAgentsPerDay
>;

export async function getActiveAgentsPerDay(
  request: GetActiveAgentsPerDayRequest,
): Promise<GetActiveAgentsPerDayResponse> {
  const { projectId, startDate, endDate, baseTemplateId } = request.query;

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
        ${baseTemplateId ? ' AND base_template_id = {baseTemplateId: String} ' : ''}
      GROUP BY date
      ORDER BY date;
    `,
    query_params: {
      baseTemplateId: baseTemplateId,
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
