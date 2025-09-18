import { agentTemplateV2, db, lettaTemplates, simulatedAgent, simulatedGroup } from '@letta-cloud/service-database';
import { convertRecordMemoryVariablesToMemoryVariablesV1 } from '@letta-cloud/utils-shared';
import { createEntitiesFromTemplate } from '../createEntitiesFromTemplate/createEntitiesFromTemplate';
import { and, eq } from 'drizzle-orm';

interface CreateSimulatedAgentArgs {
  organizationId: string;
  lettaTemplateId: string;
  lettaAgentsId: string;
  projectId: string;
  isDefault?: boolean;
}


export async function createSimulatedEntities(args: CreateSimulatedAgentArgs) {
  const {
    projectId,
    organizationId,
    lettaAgentsId,
    lettaTemplateId,
    isDefault = false
  } = args;

  // find parent template
  const template = await db.query.lettaTemplates.findFirst({
    where: eq(lettaTemplates.id, lettaTemplateId)
  });

  if (!template) {
    throw new Error(`Template with ID ${lettaTemplateId} not found`);
  }

  // Create the simulated agent
  const { agents, group, deploymentId } = await createEntitiesFromTemplate({
    projectId,
    lettaAgentsId,
    template,
    organizationId,
    overrides: {
      hidden: true
    }
  });


  await Promise.all(agents.map(async (agent) => {
    if (!agent?.id || !agent?.project_id || !agent.entity_id) {
      throw new Error('Failed to create simulated agent');
    }

    const agentTemplate = await db.query.agentTemplateV2.findFirst({
      where: and(
        eq(agentTemplateV2.entityId, agent.entity_id),
        eq(agentTemplateV2.lettaTemplateId, template.id)
      ),
      columns: {
        id: true
      }
    });

    if (!agentTemplate) {
      throw new Error('Failed to create simulated agent');
    }

    const simulatedAgentData = {
      agentId: agent.id,
      projectId: agent.project_id,
      organizationId,
      isDefault,
      deploymentId,
      lettaTemplateId: template.id,
      agentTemplateId: agentTemplate.id,
      memoryVariables: convertRecordMemoryVariablesToMemoryVariablesV1({})
    };

    await db
      .insert(simulatedAgent)
      .values(simulatedAgentData)
      .onConflictDoNothing();
  }));

  if (group) {
    await db
      .insert(simulatedGroup)
      .values({
        isDefault,
        groupId: group.id,
        organizationId,
        deploymentId,
        projectId,
        lettaTemplateId: template.id
      })
      .onConflictDoNothing();
  }
}
