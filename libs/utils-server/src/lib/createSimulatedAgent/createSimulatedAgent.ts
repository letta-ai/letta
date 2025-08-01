import { db, simulatedAgent } from '@letta-cloud/service-database';
import { copyAgentById } from '../copyAgentById/copyAgentById';
import type { AgentState } from '@letta-cloud/sdk-core';

interface CreateSimulatedAgentArgs {
  memoryVariables: Record<string, string>;
  agentTemplateId: string;
  deployedAgentTemplateId?: string | null;
  organizationId: string;
  lettaAgentsId: string;
  projectId: string;
  isDefault?: boolean;
}

interface CreateSimulatedAgentResult {
  agent: AgentState;
  simulatedAgentRecord: {
    agentId: string;
    projectId: string;
    organizationId: string;
    isDefault: boolean;
    agentTemplateId: string;
    deployedAgentTemplateId: string | null;
    variables: {
      memoryVariables: Record<string, string>;
    };
  };
}

export async function createSimulatedAgent(
  args: CreateSimulatedAgentArgs,
): Promise<CreateSimulatedAgentResult> {
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
    isDefault: isDefault || deployedAgentTemplateId === null,
    agentTemplateId,
    deployedAgentTemplateId,
    variables: {
      memoryVariables,
    },
  };

  await db.insert(simulatedAgent).values(simulatedAgentData);

  return {
    agent,
    simulatedAgentRecord: simulatedAgentData,
  };
}
