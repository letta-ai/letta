import {
  agentTemplates,
  db,
  deployedAgentVariables,
} from '@letta-cloud/service-database';
import {
  AgentsService,
  isAPIError,
} from '@letta-cloud/sdk-core';
import { inArray } from 'drizzle-orm/sql/expressions/conditions';
import { and, eq, isNull } from 'drizzle-orm';

interface AgentResponse {
  agentId: string;
  variables: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/max-params
export async function getAgentsBatchFromTemplate(
  template: string,
  organizationId: string,
  coreUserId: string,
  after?: string,
  limit = 50,
): Promise<{
  agents: AgentResponse[];
  nextCursor?: string;
  hasMore: boolean;
}> {
  const [baseName] = template.split(':');

  const rootAgentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      ...[
        eq(agentTemplates.organizationId, organizationId),
        eq(agentTemplates.name, baseName),
        isNull(agentTemplates.deletedAt),
      ],
    ),
  });

  if (!rootAgentTemplate) {
    throw new Error(
      `Template ${baseName} not found in organization ${organizationId}`,
    );
  }

  const deployedAgentsList = await AgentsService.listAgents(
    {
      baseTemplateId: rootAgentTemplate.id,
      limit,
      after,
    },
    {
      user_id: coreUserId,
    },
  ).catch((res) => {
    if (isAPIError(res)) {
      console.error('API Error fetching agents from template:', res.status);
      console.error('API Error fetching agents from template:', res.body);
    }
    throw res;
  });

  if (deployedAgentsList.length === 0) {
    return { agents: [], hasMore: false };
  }

  // Fetch variables for this batch of agents
  const variables = await db.query.deployedAgentVariables.findMany({
    where: inArray(
      deployedAgentVariables.deployedAgentId,
      deployedAgentsList.map((v) => v.id),
    ),
  });

  const agents = variables.map(({ deployedAgentId, value }) => ({
    variables: value,
    agentId: deployedAgentId,
  }));

  // Determine if there are more agents to fetch
  const hasMore = deployedAgentsList.length === limit;
  const nextCursor = hasMore
    ? deployedAgentsList[deployedAgentsList.length - 1].id
    : undefined;

  console.log(
    `Fetched batch of ${agents.length} agents from template ${baseName}${after ? ` (cursor: ${after})` : ''}`,
  );

  return {
    agents,
    nextCursor,
    hasMore,
  };
}

export async function getAgentsByIds(
  agentIds: string[],
): Promise<AgentResponse[]> {
  const res = await db.query.deployedAgentVariables.findMany({
    where: inArray(deployedAgentVariables.deployedAgentId, agentIds),
  });

  return res.map(({ deployedAgentId, value }) => ({
    variables: value,
    agentId: deployedAgentId,
  }));
}
