import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';

import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import {
  agentTemplates,
  db,
  deployedAgentMetadata,
  deployedAgentVariables,
} from '@letta-cloud/service-database';
import type { SDKContext } from '../types';
import { getDeployedTemplateByVersion } from '@letta-cloud/utils-server';
import { copyAgentById } from '@letta-cloud/utils-server';
import { getContextDataHack } from '../getContextDataHack/getContextDataHack';
import { and, eq, ilike } from 'drizzle-orm';

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
  const {
    memory_variables,
    initial_message_sequence,
    identity_ids,
    tool_variables,
    agent_name,
    tags,
  } = req.body;

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
      identityIds: identity_ids,
      initialMessageSequence: initial_message_sequence,
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

type ListTemplatesRequest = ServerInferRequest<
  typeof cloudContracts.templates.listTemplates
>;

type ListTemplatesResponse = ServerInferResponses<
  typeof cloudContracts.templates.listTemplates
>;

async function listTemplates(
  req: ListTemplatesRequest,
  context: SDKContext,
): Promise<ListTemplatesResponse> {
  const { organizationId } = getContextDataHack(req, context);

  const { query } = req;

  const { name, limit = 1, offset = 0, projectId } = query;

  const templatesResponse = await db.query.agentTemplates.findMany({
    where: and(
      ...[
        eq(agentTemplates.organizationId, organizationId),
        ...(name ? [ilike(agentTemplates.name, `%${name}%`)] : []),
        ...(projectId ? [eq(agentTemplates.projectId, projectId)] : []),
      ],
    ),
    with: {
      project: {
        columns: {
          slug: true
        }
      }
    },
    offset,
    limit: limit + 1,
  });

  return {
    status: 200,
    body: {
      templates: templatesResponse.slice(0, limit).map((template) => ({
        id: template.id,
        name: template.name,
        project_slug: template.project.slug,
        project_id: template.projectId,
        template_deployment_slug: `${template.project.slug}/${template.name}:latest`,
      })),
      has_next_page: templatesResponse.length > limit,
    },
  };
}

export const templatesRouter = {
  createAgentsFromTemplate,
  listTemplates,
};
