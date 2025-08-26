import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import { isAPIError } from '@letta-cloud/sdk-core';
import * as Sentry from '@sentry/node';
import type { AgentState, ListAgentsData } from '@letta-cloud/sdk-core';
import { AgentsService } from '@letta-cloud/sdk-core';
import {
  agentTemplates,
  db,
  deployedAgentMetadata,
  lettaTemplates,
  deployedAgentVariables,
  organizationPreferences,
  projects
} from '@letta-cloud/service-database';
import { and, eq, isNull } from 'drizzle-orm';
import { getTemplateByName } from '@letta-cloud/utils-server';
import { LRUCache } from 'lru-cache';
import { cloudApiRouter } from '../router';
import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import type { SDKContext } from '../types';
import { getContextDataHack } from '../getContextDataHack/getContextDataHack';
import { validateVersionString } from '@letta-cloud/utils-shared';

type CreateAgentRequest = ServerInferRequest<
  typeof cloudContracts.agents.createAgent
>;

type CreateAgentResponse = ServerInferResponses<
  typeof cloudContracts.agents.createAgent
>;

interface GetCatchAllProjectId {
  organizationId: string;
}

async function getCatchAllProjectId(args: GetCatchAllProjectId) {
  const { organizationId } = args;

  const orgPrefResponse = await db.query.organizationPreferences.findFirst({
    where: eq(organizationPreferences.organizationId, organizationId),
    columns: {
      defaultProjectId: true,
    },
  });

  if (!orgPrefResponse?.defaultProjectId) {
    Sentry.captureMessage(
      `Organization preferences not found for organization ${organizationId}`,
    );

    throw new Error('Organization preferences not found');
  }

  return orgPrefResponse.defaultProjectId;
}

async function createAgent(
  req: CreateAgentRequest,
  context: SDKContext,
): Promise<CreateAgentResponse> {
  const { organizationId, userId, lettaAgentsUserId } = getContextDataHack(
    req,
    context,
  );
  const {
    project,
    from_template,
    template,
    project_id,
    memory_variables,
    ...agent
  } = req.body;

  const projectSlug =
    getContextDataHack(req, context).headers?.['x-project'] ?? project;

  if (template) {
    return {
      status: 400,
      body: {
        message:
          'Programmatic creation of templates is not supported. If you want to create an agent from a template, check out (https://docs.letta.com/api-reference/templates/agents/create)',
      },
    };
  }

  if (projectSlug && project_id) {
    return {
      status: 400,
      body: {
        message: 'project and project_id cannot be used together',
      },
    };
  }

  // identify the project id
  let projectId = project_id;

  if (!projectId) {
    // if no project_id is specified, lets check for project, which uses the project slug
    if (projectSlug) {
      const foundProject = await db.query.projects.findFirst({
        where: and(
          eq(projects.organizationId, organizationId),
          eq(projects.slug, projectSlug),
          isNull(projects.deletedAt),
        ),
      });

      if (!foundProject) {
        return {
          status: 404,
          body: {
            message: `Project ${projectSlug} not found`,
          },
        };
      }

      projectId = foundProject.id;
    } else {
      // if no project_id or project is specified, we will use the catch all project
      projectId = await getCatchAllProjectId({ organizationId });
    }
  }

  if (!projectId) {
    return {
      status: 400,
      body: {
        message: 'Project ID is required',
      },
    };
  }

  if (!from_template) {
    try {
      // standard agent creation route, this should just pipe
      // the request to the agents service
      const response = await AgentsService.createAgent(
        {
          requestBody: {
            project_id: projectId,
            ...agent,
          },
        },
        {
          user_id: lettaAgentsUserId,
        },
      );

      await db.insert(deployedAgentMetadata).values({
        agentId: response.id,
        organizationId,
        projectId,
      });

      return {
        status: 201,
        body: response,
      };
    } catch (e) {
      if (isAPIError(e)) {
        return {
          status: 400,
          body: e.body,
        };
      }
      return {
        status: 500,
        body: {
          message: 'Failed to create agent',
        },
      };
    }
  }

  // logic for creating agents from templates
  if (project_id || projectSlug) {
    return {
      status: 400,
      body: {
        message:
          "Do not specify project or project_id when creating an agent from a template, agents created from a template will use the template's project",
      },
    };
  }

  const [name] = from_template.split(':');

  const tplt = await db.query.lettaTemplates.findFirst({
    where: and(
      eq(agentTemplates.organizationId, organizationId),
      eq(agentTemplates.name, name),
      isNull(agentTemplates.deletedAt),
    ),
    with: {
      project: {
        columns: {
          slug: true,
        }
      }
    }
  });

  if (!tplt?.project?.slug) {
    return {
      status: 404,
      body: {
        message: `Template ${name} not found`,
      },
    };
  }

  const deployedAgentTemplate =
    await cloudApiRouter.templates.createAgentsFromTemplate(
      {
        params: {
          project: tplt.project.slug,
          template_version: from_template,
        },
        body: {
          tags: agent.tags || [],
          agent_name: agent.name,
          identity_ids: agent.identity_ids || [],
          memory_variables: memory_variables || {},
          tool_variables: agent.tool_exec_environment_variables || {},
        },
      },
      {
        request: {
          organizationId,
          lettaAgentsUserId,
          source: 'api',
          projectSlug,
          userId,
        },
      },
    );

  if (deployedAgentTemplate.status !== 201) {
    return deployedAgentTemplate;
  }

  if (!deployedAgentTemplate.body.agents[0]) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent from template',
      },
    };
  }

  return {
    status: 201,
    body: deployedAgentTemplate.body.agents[0] as AgentState,
  };
}


type GetAgentByIdRequest = ServerInferRequest<
  typeof cloudContracts.agents.getAgentById
>;

type GetAgentByIdResponse = ServerInferResponses<
  typeof cloudContracts.agents.getAgentById
>;

async function getAgentById(
  req: GetAgentByIdRequest,
  context: SDKContext,
): Promise<GetAgentByIdResponse> {
  const { agent_id: agentId, include_relationships: includeRelationships } =
    req.params;

  const [agent, agentTemplate] = await Promise.all([
    AgentsService.retrieveAgent(
      {
        agentId,
        includeRelationships,
      },
      {
        user_id: getContextDataHack(req, context).lettaAgentsUserId,
      },
    ),
    db.query.agentTemplates.findFirst({
      where: and(
        eq(
          agentTemplates.organizationId,
          getContextDataHack(req, context).organizationId,
        ),
        eq(agentTemplates.id, agentId),
        isNull(agentTemplates.deletedAt),
      ),
    }),
  ]);

  if (agentTemplate && getContextDataHack(req, context).source !== 'web') {
    return {
      status: 400,
      body: 'This agentId corresponds to a template, please edit this template from the ADE',
    };
  }

  return {
    status: 200,
    body: agent,
  };
}

type DeleteAgentRequest = ServerInferRequest<
  typeof cloudContracts.agents.deleteAgent
>;

type DeleteAgentResponse = ServerInferResponses<
  typeof cloudContracts.agents.deleteAgent
>;

async function deleteAgent(
  req: DeleteAgentRequest,
  context: SDKContext,
): Promise<DeleteAgentResponse> {
  const { agent_id: agentId } = req.params;

  const [deployedAgent, agentTemplate] = await Promise.all([
    AgentsService.retrieveAgent(
      {
        agentId,
        includeRelationships: [],
      },
      {
        user_id: getContextDataHack(req, context).lettaAgentsUserId,
      },
    ),
    db.query.agentTemplates.findFirst({
      where: and(
        eq(
          agentTemplates.organizationId,
          getContextDataHack(req, context).organizationId,
        ),
        eq(agentTemplates.id, agentId),
        isNull(agentTemplates.deletedAt),
      ),
    }),
  ]);

  if (!deployedAgent && !agentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Agent not found',
      },
    };
  }

  if (agentTemplate && getContextDataHack(req, context).source !== 'web') {
    return {
      status: 400,
      body: {
        message:
          'Cannot delete agent template via API, please delete in the UI',
      },
    };
  } else if (agentTemplate) {
    await db
      .delete(agentTemplates)
      .where(eq(agentTemplates.id, agentTemplate.id));
  }

  await AgentsService.deleteAgent(
    {
      agentId,
    },
    {
      user_id: getContextDataHack(req, context).lettaAgentsUserId,
    },
  );

  try {
    await db
      .delete(deployedAgentMetadata)
      .where(eq(deployedAgentMetadata.agentId, agentId));
  } catch (_e) {
    console.log(_e);
    //
  }

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type SearchDeployedAgentsRequest = ServerInferRequest<
  typeof cloudContracts.agents.searchDeployedAgents
>;

type SearchDeployedAgentsResponse = ServerInferResponses<
  typeof cloudContracts.agents.searchDeployedAgents
>;

const idToTemplateCache = new LRUCache<string, string>({
  max: 100,
  ttl: 1000 * 60 * 60 * 24,
});

async function searchDeployedAgents(
  req: SearchDeployedAgentsRequest,
  context: SDKContext,
): Promise<SearchDeployedAgentsResponse> {
  const {
    search = [],
    project_id,
    limit = 5,
    after,
    sortBy,
    ascending,
  } = req.body;

  if (!project_id) {
    return {
      status: 400,
      body: {
        message: 'project_id is required',
      },
    };
  }

  const query: Partial<ListAgentsData> = {};

  await Promise.all(
    search.map(async (searchTerm) => {
      if (searchTerm.field === 'identity') {
        query.identityId = searchTerm.value;
      }

      if (searchTerm.field === 'name') {
        if (searchTerm.operator === 'eq') {
          query.name = searchTerm.value;
        } else if (searchTerm.operator === 'contains') {
          query.queryText = searchTerm.value;
        }
      }

      if (searchTerm.field === 'tags') {
        query.tags = searchTerm.value;
      }

      if (searchTerm.field === 'version') {
        const { organizationId, lettaAgentsUserId } = getContextDataHack(req, context);

        if (!validateVersionString(searchTerm.value)) {
          return;
        }


        const deployedAgentTemplate = await getTemplateByName({
          versionString: searchTerm.value,
          organizationId: organizationId,
          lettaAgentsId: lettaAgentsUserId,
        });


        if (!deployedAgentTemplate) {
          return;
        }

        query.templateId = deployedAgentTemplate.id;

        return;
      }

      if (searchTerm.field === 'templateName') {
        const { organizationId, lettaAgentsUserId } = getContextDataHack(req, context);

        // remove version part if it exists
        const [name] = searchTerm.value.split(':');

        const versionString = `${name}:current`;

        if (!validateVersionString(versionString)) {
          return;
        }


        const templateFamily = await getTemplateByName({
          versionString,
          organizationId: organizationId,
          lettaAgentsId: lettaAgentsUserId,
        });

        if (!templateFamily) {
          return;
        }

        query.baseTemplateId = templateFamily.id;

        return;
      }
    }),
  );
  const result = await AgentsService.listAgents(
    {
      ...query,
      limit: limit + 1,
      projectId: project_id,
      after,
      includeRelationships: ['tags'],
      ...(sortBy && { sortBy }),
      ...(ascending !== undefined && { ascending }),
    },
    {
      user_id: getContextDataHack(req, context).lettaAgentsUserId,
    },
  );

  const enrichedAgents = await Promise.all(
    result.map(async (agent) => {
      const templateId = agent.template_id || '';
      const cachedTemplate = idToTemplateCache.get(templateId);

      if (cachedTemplate) {
        return {
          ...agent,
          template: cachedTemplate,
        };
      }

      const template = await db.query.lettaTemplates.findFirst({
        where: and(
          eq(
            lettaTemplates.organizationId,
            getContextDataHack(req, context).organizationId,
          ),
          eq(lettaTemplates.id, templateId),
        ),
      });

      if (!template) {
        return agent;
      }

      const version = `${template.name || 'unknown'}:${template.version}`;

      idToTemplateCache.set(templateId, version);

      return {
        ...agent,
        template: version,
      };
    }),
  );

  return {
    status: 200,
    body: {
      agents: enrichedAgents.slice(0, limit),
      nextCursor: result.length > limit ? result[result.length - 1].id : null,
    },
  };
}

type GetAgentVariablesRequest = ServerInferRequest<
  typeof cloudContracts.agents.getAgentVariables
>;

type GetAgentVariablesResponse = ServerInferResponses<
  typeof cloudContracts.agents.getAgentVariables
>;

async function getAgentVariables(
  req: GetAgentVariablesRequest,
  context: SDKContext,
): Promise<GetAgentVariablesResponse> {
  const { agent_id: agentId } = req.params;

  // find agent

  const agent = await AgentsService.retrieveAgent(
    {
      agentId,
      includeRelationships: [],
    },
    {
      user_id: getContextDataHack(req, context).lettaAgentsUserId,
    },
  );

  if (!agent) {
    return {
      status: 404,
      body: {
        message: 'Agent not found',
      },
    };
  }

  const deployedAgentVariablesItem =
    await db.query.deployedAgentVariables.findFirst({
      where: and(
        eq(deployedAgentVariables.deployedAgentId, agentId),
        isNull(deployedAgentVariables.deletedAt),
        eq(
          deployedAgentVariables.organizationId,
          getContextDataHack(req, context).organizationId,
        ),
      ),
    });

  return {
    status: 200,
    body: {
      variables: deployedAgentVariablesItem?.value || {},
    },
  };
}

export const agentsRouter = {
  createAgent,
  getAgentVariables,
  getAgentById,
  deleteAgent,
  searchDeployedAgents,
};
