import { agentTemplates, db, deployedAgentVariables } from '@letta-cloud/service-database';
import { AgentsService, isAPIError } from '@letta-cloud/sdk-core';
import { inArray } from 'drizzle-orm/sql/expressions/conditions';
import { and, eq, isNull } from 'drizzle-orm';

interface AgentResponse {
  agentId: string;
  variables: Record<string, string>;
}

export async function getAgentsFromTemplate(
  template: string,
  organizationId: string,
  coreUserId: string,
): Promise<AgentResponse[]> {

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
    throw new Error(`Template ${baseName} not found in organization ${organizationId}`);
  }

  const deployedAgentsList = await AgentsService.listAgents(
    {
      baseTemplateId: rootAgentTemplate.id,
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

  const variables = await db.query.deployedAgentVariables.findMany({
    where: inArray(
      deployedAgentVariables.deployedAgentId,
      deployedAgentsList.map((v) => v.id),
    ),
  });

  return variables.map(({ deployedAgentId, value }) => ({
    variables: value,
    agentId: deployedAgentId,
  }));
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
