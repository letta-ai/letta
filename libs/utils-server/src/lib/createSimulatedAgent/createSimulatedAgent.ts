import { db, simulatedAgent } from '@letta-cloud/service-database';
import { copyAgentById } from '../copyAgentById/copyAgentById';
import type { AgentState } from '@letta-cloud/sdk-core';
import type { MemoryVariableVersionOneType } from '@letta-cloud/types';

interface CreateSimulatedAgentArgs {
  memoryVariables: Record<string, string>;
  agentTemplateId: string;
  deployedAgentTemplateId?: string | null;
  organizationId: string;
  lettaAgentsId: string;
  projectId: string;
  isDefault?: boolean;
}

export function recordMemoryVariablesToMemoryVariablesV1(
  memoryVariables: Record<string, string>,
): MemoryVariableVersionOneType {
  return {
    data: Object.entries(memoryVariables).map(([key, label]) => ({
      key,
      label,
      type: 'string',
    })),
    version: '1',
  };
}

export async function createSimulatedAgent(args: CreateSimulatedAgentArgs) {
  const {
    memoryVariables,
    agentTemplateId,
    projectId,
    deployedAgentTemplateId = null,
    organizationId,
    lettaAgentsId,
    isDefault = false,
  } = args;

  // Create the simulated agent
  const agent = await copyAgentById(agentTemplateId, lettaAgentsId, {
    memoryVariables,
    projectId,
    hidden: true,
  });

  if (!agent?.id || !agent?.project_id) {
    throw new Error('Failed to create simulated agent');
  }

  // Save to database
  const simulatedAgentData = {
    agentId: agent.id,
    projectId: agent.project_id,
    organizationId,
    isDefault: isDefault,
    agentTemplateId,
    deployedAgentTemplateId,
    memoryVariables: recordMemoryVariablesToMemoryVariablesV1(memoryVariables),
  };

  const [res] = await db
    .insert(simulatedAgent)
    .values(simulatedAgentData)
    .returning();

  return {
    agent,
    simulatedAgentRecord: res,
  };
}
