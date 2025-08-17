import { db, lettaTemplates, simulatedAgent } from '@letta-cloud/service-database';
import { convertRecordMemoryVariablesToMemoryVariablesV1 } from '@letta-cloud/utils-shared';
import { createEntitiesFromTemplate } from '../createEntitiesFromTemplate/createEntitiesFromTemplate';
import { eq } from 'drizzle-orm';

interface CreateSimulatedAgentArgs {
  memoryVariables: Record<string, string>;
  agentTemplateId: string;
  organizationId: string;
  lettaTemplateId: string;
  lettaAgentsId: string;
  projectId: string;
  isDefault?: boolean;
}


export async function createSimulatedAgent(args: CreateSimulatedAgentArgs) {
  const {
    memoryVariables,
    agentTemplateId,
    projectId,
    organizationId,
    lettaAgentsId,
    lettaTemplateId,
    isDefault = false
  } = args;

  // find parent template
  const template = await db.query.lettaTemplates.findFirst({
    where: eq(lettaTemplates.id, lettaTemplateId),
  });

  if (!template) {
    throw new Error(`Template with ID ${lettaTemplateId} not found`);
  }

  // Create the simulated agent
  const [agent] = await createEntitiesFromTemplate({
    projectId,
    lettaAgentsId,
    template,
    overrides: {
      memoryVariables,
      hidden: true,
    },
  })

  if (!agent?.id || !agent?.project_id) {
    throw new Error('Failed to create simulated agent');
  }


  // Save to database
  const simulatedAgentData = {
    agentId: agent.id,
    projectId: agent.project_id,
    organizationId,
    isDefault,
    agentTemplateId,
    memoryVariables: convertRecordMemoryVariablesToMemoryVariablesV1(memoryVariables),
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
