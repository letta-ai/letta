import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { sdkContracts } from '@letta-cloud/letta-agents-api';
import {
  agentTemplates,
  db,
  deployedAgents,
  deployedAgentTemplates,
  deployedAgentVariables,
  projects,
} from '@letta-cloud/database';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { copyAgentById, prepareAgentForUser } from '$web/sdk';
import type { SDKContext } from '$web/sdk/shared';

type CreateAgentsFromTemplateRequest = ServerInferRequest<
  typeof sdkContracts.templates.createAgentsFromTemplate
>;
type CreateAgentsFromTemplateResponse = ServerInferResponses<
  typeof sdkContracts.templates.createAgentsFromTemplate
>;

async function createAgentsFromTemplate(
  req: CreateAgentsFromTemplateRequest,
  context: SDKContext,
): Promise<CreateAgentsFromTemplateResponse> {
  const { organizationId, lettaAgentsUserId } = context.request;
  const { project: projectSlug, template_version } = req.params;
  const { agent_name: name, memory_variables, tool_variables } = req.body;
  const [templateName, version] = template_version.split(':');

  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, projectSlug),
  });

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.name, templateName),
      eq(agentTemplates.projectId, project.id),
    ),
  });

  if (!agentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Agent template not found',
      },
    };
  }

  const deployedAgentTemplate = await (() => {
    if (version === 'latest') {
      return db.query.deployedAgentTemplates.findFirst({
        where: and(
          eq(
            deployedAgentTemplates.organizationId,
            context.request.organizationId,
          ),
          eq(deployedAgentTemplates.agentTemplateId, agentTemplate.id),
          isNull(deployedAgentTemplates.deletedAt),
        ),
        orderBy: [desc(deployedAgentTemplates.createdAt)],
      });
    } else {
      return db.query.deployedAgentTemplates.findFirst({
        where: and(
          eq(
            deployedAgentTemplates.organizationId,
            context.request.organizationId,
          ),
          eq(deployedAgentTemplates.version, version),
          eq(deployedAgentTemplates.agentTemplateId, agentTemplate.id),
          isNull(deployedAgentTemplates.deletedAt),
        ),
      });
    }
  })();

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {
        message: 'A template with this version does not exist',
      },
    };
  }

  const response = await copyAgentById(
    deployedAgentTemplate.id,
    lettaAgentsUserId,
    {
      memoryVariables: memory_variables,
      toolVariables: tool_variables,
    },
  );

  if (!response?.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent from template',
      },
    };
  }

  let uniqueId = name;
  let nextInternalAgentCountId = 0;

  if (!uniqueId) {
    const lastDeployedAgent = await db.query.deployedAgents.findFirst({
      where: eq(deployedAgents.organizationId, organizationId),
      orderBy: [desc(deployedAgents.createdAt)],
    });

    nextInternalAgentCountId =
      (lastDeployedAgent?.internalAgentCountId || 0) + 1;

    uniqueId = `deployed-agent-${nextInternalAgentCountId}`;
  }

  const [createdAgent] = await db
    .insert(deployedAgents)
    .values({
      id: response.id,
      projectId: project.id,
      key: uniqueId,
      rootAgentTemplateId: agentTemplate.id,
      internalAgentCountId: nextInternalAgentCountId,
      deployedAgentTemplateId: deployedAgentTemplate.id,
      organizationId,
    })
    .returning({ deployedAgentId: deployedAgents.id });

  await db.insert(deployedAgentVariables).values({
    deployedAgentId: createdAgent.deployedAgentId,
    value: memory_variables || {},
    organizationId,
  });

  return {
    status: 201,
    body: {
      agents: [
        await prepareAgentForUser(response, {
          projectId: project.id,
          agentName: uniqueId,
        }),
      ],
    },
  };
}

export const templatesRouter = {
  createAgentsFromTemplate,
};
