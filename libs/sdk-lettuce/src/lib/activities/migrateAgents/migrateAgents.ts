import {
  getDeployedTemplateByVersion,
  updateAgentFromAgentId,
} from '@letta-cloud/utils-server';
import {
  db,
  deployedAgentTemplates,
  deployedAgentVariables,
} from '@letta-cloud/service-database';
import type { MigrateAgentsPayload } from '../../types';
import { AgentsService } from '@letta-cloud/sdk-core';
import { inArray } from 'drizzle-orm/sql/expressions/conditions';

interface AgentResponse {
  agentId: string;
  variables: Record<string, string>;
}

export async function getAgentsFromTemplate(
  templateId: string,
  coreUserId: string,
): Promise<AgentResponse[]> {
  const deployedAgentsList = await AgentsService.listAgents(
    {
      baseTemplateId: templateId,
    },
    {
      user_id: coreUserId,
    },
  );

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

export async function migrateAgents(
  payload: MigrateAgentsPayload,
): Promise<boolean> {
  const {
    memoryVariables,
    agentIds: specificAgentIds,
    organizationId,
    template,
    preserveCoreMemories,
    coreUserId,
  } = payload;

  const deployedAgentTemplate = await getDeployedTemplateByVersion(
    template,
    organizationId,
  );

  if (!deployedAgentTemplate) {
    // Template version provided does not exist
    return false;
  }

  if (!deployedAgentTemplate?.id) {
    // Template id not found
    return false;
  }

  const agents = specificAgentIds
    ? await getAgentsByIds(specificAgentIds)
    : await getAgentsFromTemplate(
        deployedAgentTemplate.agentTemplateId,
        coreUserId,
      );

  await Promise.all(
    agents.map(async (agent) => {
      await updateAgentFromAgentId({
        memoryVariables: memoryVariables || agent.variables,
        baseAgentId: deployedAgentTemplate.id,
        agentToUpdateId: agent.agentId,
        lettaAgentsUserId: coreUserId,
        preserveCoreMemories,
        baseTemplateId: deployedAgentTemplate.agentTemplateId,
        templateId: deployedAgentTemplate.id,
      });
    }),
  );

  return true;
}
