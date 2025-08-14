import {
  getDeployedTemplateByVersion,
  updateAgentFromAgentId,
} from '@letta-cloud/utils-server';
import {
  db,
  deployedAgentVariables,
} from '@letta-cloud/service-database';
import type { MigrateAgentPayload } from '../../types';
import { eq } from 'drizzle-orm';

interface AgentResponse {
  agentId: string;
  variables: Record<string, string>;
}

export async function getAgentById(agentId: string): Promise<AgentResponse | null> {
  const res = await db.query.deployedAgentVariables.findFirst({
    where: eq(deployedAgentVariables.deployedAgentId, agentId),
  });

  if (!res) {
    return null;
  }

  return {
    variables: res.value,
    agentId: res.deployedAgentId,
  };
}

export async function migrateAgent(
  payload: MigrateAgentPayload,
): Promise<boolean> {
  const {
    memoryVariables,
    agentId,
    organizationId,
    template,
    preserveCoreMemories,
    preserveToolVariables,
    coreUserId,
  } = payload;

  const deployedAgentTemplate = await getDeployedTemplateByVersion(
    template,
    organizationId,
  );

  if (!deployedAgentTemplate) {
    // Template version provided does not exist
    console.error(`Template version ${template} does not exist for organization ${organizationId}`);
    return false;
  }

  if (!deployedAgentTemplate?.id) {
    // Template id not found
    console.error(`Template id not found for template ${template}`);
    return false;
  }

  // Get the current agent data
  const agent = await getAgentById(agentId);
  if (!agent) {
    console.error(`Agent ${agentId} not found`);
    return false;
  }

  try {
    await updateAgentFromAgentId({
      memoryVariables: memoryVariables || agent.variables,
      baseAgentId: deployedAgentTemplate.id,
      agentToUpdateId: agent.agentId,
      lettaAgentsUserId: coreUserId,
      preserveCoreMemories,
      preserveToolVariables,
      baseTemplateId: deployedAgentTemplate.agentTemplateId,
      templateId: deployedAgentTemplate.id,
    });

    console.log(`Successfully migrated agent ${agentId} to template ${template}`);
    return true;
  } catch (error) {
    console.error(`Failed to migrate agent ${agentId}:`, error);
    throw error;
  }
}
