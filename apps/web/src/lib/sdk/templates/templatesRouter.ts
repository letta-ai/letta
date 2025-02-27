import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';

import type { sdkContracts } from '@letta-cloud/letta-agents-api';
import {
  db,
  deployedAgentMetadata,
  deployedAgentVariables,
} from '@letta-cloud/database';
import type { SDKContext } from '$web/sdk/shared';
import { getDeployedTemplateByVersion } from '@letta-cloud/server-utils';
import { copyAgentById } from '$web/server/lib/copyAgentById/copyAgentById';

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
  const { template_version } = req.params;
  const { memory_variables, tool_variables, agent_name, tags } = req.body;

  // when template creation on agents is deprecated, we can remove this
  // const project = await db.query.projects.findFirst({
  //   where: eq(projects.slug, projectSlug),
  // });
  //
  // if (!project) {
  //   return {
  //     status: 404,
  //     body: {
  //       message: 'Project not found',
  //     },
  //   };
  // }

  const deployedAgentTemplate = await getDeployedTemplateByVersion(
    template_version,
    organizationId,
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {
        message:
          'This template does not exist, be sure to follow the following format: project_slug/template_name:version',
      },
    };
  }

  const response = await copyAgentById(
    deployedAgentTemplate.id,
    lettaAgentsUserId,
    {
      name: agent_name,
      tags,
      memoryVariables: memory_variables,
      toolVariables: tool_variables,
      projectId: deployedAgentTemplate.projectId,
      templateVersionId: deployedAgentTemplate.id,
      baseTemplateId: deployedAgentTemplate.agentTemplateId,
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

  await db.insert(deployedAgentMetadata).values({
    agentId: response.id,
    organizationId,
    projectId: deployedAgentTemplate.projectId,
  });

  await db.insert(deployedAgentVariables).values({
    deployedAgentId: response.id,
    value: memory_variables || {},
    organizationId,
  });

  return {
    status: 201,
    body: {
      agents: [response],
    },
  };
}

export const templatesRouter = {
  createAgentsFromTemplate,
};
