import { agentTemplateV2, db, lettaTemplates, simulatedAgent, simulatedGroup } from '@letta-cloud/service-database';
import {
  convertMemoryVariablesV1ToRecordMemoryVariables,
} from '@letta-cloud/utils-shared';
import { createEntitiesFromTemplate } from '../createEntitiesFromTemplate/createEntitiesFromTemplate';
import { and, eq } from 'drizzle-orm';
import { InternalTemplatesService } from '@letta-cloud/sdk-core';
import * as Sentry from '@sentry/node';

interface FlushSimulatedAgentsArgs {
  organizationId: string;
  lettaTemplateId: string;
  lettaAgentsId: string;
  projectId: string;
  deploymentId: string;
  isDefault?: boolean;
}


export async function flushSimulatedEntities(args: FlushSimulatedAgentsArgs) {
  const {
    projectId,
    deploymentId: existingDeploymentId,
    organizationId,
    lettaAgentsId,
    lettaTemplateId,
  } = args;

  // find parent template
  const template = await db.query.lettaTemplates.findFirst({
    where: eq(lettaTemplates.id, lettaTemplateId),
  });

  if (!template) {
    throw new Error(`Template with ID ${lettaTemplateId} not found`);
  }


  // Delete the existing agent from Letta service
  void InternalTemplatesService.deleteDeployment({
    deploymentId: existingDeploymentId || '',
  }, {
    user_id: lettaAgentsId,
  }).catch((e) => {
    Sentry.captureException(e);
  });


  const existingSimulatedAgents = await db.query.simulatedAgent.findMany({
    where: and(
      eq(simulatedAgent.lettaTemplateId, template.id),
      eq(simulatedAgent.projectId, projectId),
    ),
    columns: {
      id: true,
      memoryVariables: true,
    }
  });

  const simulatedAgentMap = new Map<string, Pick<typeof simulatedAgent.$inferSelect, 'id' | 'memoryVariables'>>();

  existingSimulatedAgents.forEach((agent) => {
    simulatedAgentMap.set(agent.id, agent);
  });

  const allMemoryVariablesFlattened = existingSimulatedAgents.map((agent) => {
    return agent.memoryVariables ? convertMemoryVariablesV1ToRecordMemoryVariables(agent.memoryVariables) : {} ;
  }).reduce( (acc, curr) => {
    return { ...acc, ...curr }
  }, {});


  // Create the simulated agent
  const { agents, group, deploymentId } = await createEntitiesFromTemplate({
    projectId,
    lettaAgentsId,
    template,
    organizationId,
    overrides: {
      hidden: true,
      memoryVariables: allMemoryVariablesFlattened,
    },
  });


  await Promise.all(agents.map(async (agent) => {
    if (!agent?.id || !agent?.project_id || !agent?.entity_id) {
      throw new Error('Failed to create simulated agent');
    }

    const agentTemplate = await db.query.agentTemplateV2.findFirst({
      where: and(
        eq(agentTemplateV2.entityId, agent.entity_id),
        eq(agentTemplateV2.organizationId, organizationId),
        eq(agentTemplateV2.lettaTemplateId, template.id),
      ),
      columns: {
        id: true,
      }
    })

    if (!agentTemplate) {
      throw new Error(`Agent template not found for agent ${agent.id}`);
    }

    const simulatedAgentData = {
      agentId: agent.id,
      deploymentId,
    };

    await db
      .update(simulatedAgent)
      .set(simulatedAgentData)
      .where(and(
        eq(simulatedAgent.agentTemplateId, agentTemplate.id),
        eq(simulatedAgent.projectId, projectId),
        eq(simulatedAgent.organizationId, organizationId),
        eq(simulatedAgent.lettaTemplateId, template.id),
      ))
  }));

  if (group) {
    const existingSimulatedGroup = await db.query.simulatedGroup.findFirst({
      where: and(
        eq(simulatedGroup.lettaTemplateId, template.id),
        eq(simulatedGroup.projectId, projectId),
      ),
    });

    if (!existingSimulatedGroup) {
      throw new Error('Failed to find existing simulated group');
    }

    await db
      .update(simulatedGroup)
      .set({
        groupId: group.id,
        deploymentId,
      })
      .where(eq(simulatedGroup.id, existingSimulatedGroup.id || ''));
  }
}
