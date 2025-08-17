/* this migrates entities from one version to another */
import { and, eq } from 'drizzle-orm';
import { agentTemplateV2, db, deployedAgentVariables, lettaTemplates } from '@letta-cloud/service-database';
import type { VersionStringWithProject } from '@letta-cloud/utils-shared';
import { getTemplateByName } from '../getTemplateByName/getTemplateByName';
import { updateAgentFromAgentTemplateId } from '../updateAgentFromAgentTemplateId/updateAgentFromAgentTemplateId';
import { AgentsService } from '@letta-cloud/sdk-core';
import { inArray } from 'drizzle-orm/sql/expressions/conditions';

interface MigrateEntitiesOptions {
  preserveToolVariables?: boolean;
  preserveCoreMemories?: boolean;
  versionString: VersionStringWithProject;
  organizationId: string;
  lettaAgentsId: string;
}

interface AgentResponse {
  agentId: string;
  variables: Record<string, string>;
}

async function getAgentsFromTemplate(
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

export async function migrateEntities(options: MigrateEntitiesOptions) {
  const { preserveToolVariables, versionString, preserveCoreMemories, organizationId, lettaAgentsId } = options;

  const template = await getTemplateByName({
    versionString,
    organizationId,
    lettaAgentsId,
  })

  if (!template) {
    throw new Error(`Template ${versionString} not found for organization ${organizationId}`);
  }

  if (template.type !== 'classic') {
    // not implemented for other types yet
    throw new Error(`Migration for template type ${template.type} is not implemented`);
  }

  // get base template id (the one with "current")
  const baseTemplate = await db.query.lettaTemplates.findFirst({
    where: and(
      eq(lettaTemplates.organizationId, organizationId),
      eq(lettaTemplates.projectId, template.projectId),
      eq(lettaTemplates.name, template.name),
      eq(lettaTemplates.version, 'current'),
    ),
    columns: {
      id: true,
    },
  });


  // get the normal agent template
  const agentTemplate = await db.query.agentTemplateV2.findFirst({
    where: and(
      eq(agentTemplateV2.organizationId, organizationId),
      eq(agentTemplateV2.lettaTemplateId, template.id),
    ),
    columns: {
      id: true,
    },
  });

  if (!baseTemplate || !agentTemplate) {
    throw new Error(`Base template for ${template.name} not found in project ${template.projectId}`);
  }

  // fetch all agents using this template id
  const agents = await getAgentsFromTemplate(baseTemplate.id, lettaAgentsId);

  if (agents.length === 0) {
    // no agents found for this template
    return false;
  }

  // iterate over agents and update them
  await Promise.all(agents.map(async (agent) => {
    const { agentId, variables } = agent;


    // update agent from template
    await updateAgentFromAgentTemplateId({
      agentTemplateId: agentTemplate.id,
      preserveToolVariables,
      preserveCoreMemories,
      agentToUpdateId: agentId,
      memoryVariables: variables,
      lettaAgentsUserId: lettaAgentsId,
      organizationId,
      templateId: template.id,
    });
  }));
}
