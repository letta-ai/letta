import { getClickhouseClient } from '../getClickhouseClient/getClickhouseClient';
import { getClickhouseData } from '../getClickhouseData/getClickhouseData';
import { getDate, getMonth, getYear } from 'date-fns';
import { db, deployedAgentMetadata } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { AgentsService } from '@letta-cloud/sdk-core';

interface ClickhouseQueryResponse {
  data: Array<{
    exists_count: string;
  }>;
}

export async function trackDailyAgentUsage(
  agentId: string,
  baseTemplateId: string,
) {
  const client = getClickhouseClient('default');

  if (!client) {
    return;
  }
  const agent = await db.query.deployedAgentMetadata.findFirst({
    where: eq(deployedAgentMetadata.agentId, agentId),
  });

  if (!agent) {
    // console.warn(`Agent with ID ${agentId} not found in the database.`);
    return;
  }

  try {
    const agentExistsQuery = `
        SELECT count() as exists_count
        FROM agent_usage
        WHERE agent_id = {agentId: String}
    `;

    const agentExistsResult = await client.query({
      query: agentExistsQuery,
      query_params: {
        agentId: agentId,
      },
    });
    const response =
      await getClickhouseData<ClickhouseQueryResponse>(agentExistsResult);

    const isFirstUsage = response.data[0].exists_count === '0';

    const now = new Date();

    const currentYear = getYear(now);
    const currentMonth = getMonth(now) + 1; // getMonth returns 0-11, so we add 1 for 1-12
    const currentDay = getDate(now);

    // Check if this agent has been used today
    const today = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

    await client.insert({
      table: 'agent_usage',
      values: [
        {
          agent_id: agentId,
          project_id: agent.projectId,
          base_template_id: baseTemplateId,
          is_first_usage: isFirstUsage,
          messaged_at: new Date(), // or your timestamp variable
          date: today, // assuming today is in YYYY-MM-DD format
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: {
        // This setting makes it ignore duplicates instead of throwing an error
        insert_deduplication_token: `${agentId}_${today}`,
      },
    });
  } catch (error) {
    console.error('Error tracking daily agent usage:', error);
    //
  }
}
