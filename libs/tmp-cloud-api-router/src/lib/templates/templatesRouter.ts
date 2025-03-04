import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';

import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import {
  db,
  deployedAgentMetadata,
  deployedAgentVariables,
} from '@letta-cloud/service-database';
import type { SDKContext } from '../types';
import { getDeployedTemplateByVersion } from '@letta-cloud/utils-server';
import { copyAgentById } from '@letta-cloud/utils-server';
import { getContextDataHack } from '../getContextDataHack/getContextDataHack';

type CreateAgentsFromTemplateRequest = ServerInferRequest<
  typeof cloudContracts.templates.createAgentsFromTemplate
>;
type CreateAgentsFromTemplateResponse = ServerInferResponses<
  typeof cloudContracts.templates.createAgentsFromTemplate
>;

async function createAgentsFromTemplate(
  req: CreateAgentsFromTemplateRequest,
  context: SDKContext,
): Promise<CreateAgentsFromTemplateResponse> {
  const { organizationId, lettaAgentsUserId } = getContextDataHack(
    req,
    context,
  );
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
