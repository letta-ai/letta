import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type {
  ListAgentsData,
  sdkContracts,
} from '@letta-cloud/letta-agents-api';
import * as Sentry from '@sentry/node';
import type { SDKContext } from '$web/sdk/shared';
import type { AgentState } from '@letta-cloud/letta-agents-api';
import { AgentsService } from '@letta-cloud/letta-agents-api';
import {
  agentTemplates,
  db,
  deployedAgentTemplates,
  deployedAgentVariables,
  organizationPreferences,
  projects,
} from '@letta-cloud/database';
import { and, eq, isNull } from 'drizzle-orm';
import { versionAgentTemplate } from './lib/versionAgentTemplate/versionAgentTemplate';
import { migrateAgent } from '$web/sdk/agents/lib/migrateAgent/migrateAgent';
import { getDeployedTemplateByVersion } from '@letta-cloud/server-utils';
import { LRUCache } from 'lru-cache';
import { camelCaseKeys } from '@letta-cloud/generic-utils';
import { sdkRouter } from '$web/sdk/router';
import { createTemplate } from '$web/server/lib/createTemplate/createTemplate';

type CreateAgentRequest = ServerInferRequest<
  typeof sdkContracts.agents.createAgent
>;

type CreateAgentResponse = ServerInferResponses<
  typeof sdkContracts.agents.createAgent
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
  const { organizationId, lettaAgentsUserId } = context.request;
  const {
    project,
    from_template,
    template,
    project_id,
    memory_variables,
    ...agent
  } = req.body;

  const projectSlug = context.request.projectSlug ?? project;

  if (template) {
    return {
      status: 400,
      body: {
        message:
          'Programmatic creation of agents from templates is not supported',
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

  if (!from_template) {
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

    return {
      status: 201,
      body: response,
    };
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

  const deployedAgentTemplate =
    await sdkRouter.templates.createAgentsFromTemplate(
      {
        params: {
          project: projectSlug || '',
          template_version: from_template,
        },
        body: {
          tags: agent.tags || [],
          agent_name: agent.name,
          memory_variables: memory_variables || {},
          tool_variables: agent.tool_exec_environment_variables || {},
        },
      },
      context,
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

interface GetValidProjectIdFromPayload {
  organizationId: string;
  projectId?: string | undefined;
  projectSlug?: string;
}

function getValidProjectIdFromPayload(payload: GetValidProjectIdFromPayload) {
  const { organizationId, projectId, projectSlug } = payload;
  if (projectId) {
    return db.query.projects
      .findFirst({
        where: and(
          eq(projects.organizationId, organizationId),
          eq(projects.id, projectId),
          isNull(projects.deletedAt),
        ),
        columns: {
          id: true,
        },
      })
      .then((project) => {
        if (!project) {
          return null;
        }

        return project.id;
      });
  }

  if (projectSlug) {
    return db.query.projects
      .findFirst({
        where: and(
          eq(projects.organizationId, organizationId),
          eq(projects.slug, projectSlug),
          isNull(projects.deletedAt),
        ),
        columns: {
          id: true,
        },
      })
      .then((project) => {
        if (!project) {
          return null;
        }

        return project.id;
      });
  }

  return getCatchAllProjectId({ organizationId });
}

type ListAgentsRequest = ServerInferRequest<
  typeof sdkContracts.agents.listAgents
>;

type ListAgentsResponse = ServerInferResponses<
  typeof sdkContracts.agents.listAgents
>;

async function listAgents(
  req: ListAgentsRequest,
  context: SDKContext,
): Promise<ListAgentsResponse> {
  const projectId = await getValidProjectIdFromPayload({
    organizationId: context.request.organizationId,
    projectId:
      typeof req.query.project_id === 'string'
        ? req.query.project_id
        : undefined,
    projectSlug: req.headers.project,
  });

  if (!projectId) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  const agents = await AgentsService.listAgents(
    {
      ...camelCaseKeys(req.query),
      projectId,
    },
    {
      user_id: context.request.lettaAgentsUserId,
    },
  );

  return {
    status: 200,
    body: agents,
  };
}

type GetAgentByIdRequest = ServerInferRequest<
  typeof sdkContracts.agents.getAgentById
>;

type GetAgentByIdResponse = ServerInferResponses<
  typeof sdkContracts.agents.getAgentById
>;

async function getAgentById(
  req: GetAgentByIdRequest,
  context: SDKContext,
): Promise<GetAgentByIdResponse> {
  const { agent_id: agentId } = req.params;

  const [agent, agentTemplate] = await Promise.all([
    AgentsService.retrieveAgent(
      {
        agentId,
      },
      {
        user_id: context.request.lettaAgentsUserId,
      },
    ),
    db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, context.request.organizationId),
        eq(agentTemplates.id, agentId),
        isNull(agentTemplates.deletedAt),
      ),
    }),
  ]);

  if (agentTemplate) {
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
  typeof sdkContracts.agents.deleteAgent
>;

type DeleteAgentResponse = ServerInferResponses<
  typeof sdkContracts.agents.deleteAgent
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
      },
      {
        user_id: context.request.lettaAgentsUserId,
      },
    ),
    db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, context.request.organizationId),
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

  if (agentTemplate) {
    return {
      status: 400,
      body: {
        message:
          'Cannot delete agent template via API, please delete in the UI',
      },
    };
  }

  await AgentsService.deleteAgent(
    {
      agentId,
    },
    {
      user_id: context.request.lettaAgentsUserId,
    },
  );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type UpdateAgentRequest = ServerInferRequest<
  typeof sdkContracts.agents.updateAgent
>;

type UpdateAgentResponse = ServerInferResponses<
  typeof sdkContracts.agents.updateAgent
>;

async function updateAgent(
  req: UpdateAgentRequest,
  context: SDKContext,
): Promise<UpdateAgentResponse> {
  const { agent_id: agentId } = req.params;

  const [deployedAgent, agentTemplate] = await Promise.all([
    AgentsService.retrieveAgent(
      {
        agentId,
      },
      {
        user_id: context.request.lettaAgentsUserId,
      },
    ),
    db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, context.request.organizationId),
        eq(agentTemplates.id, agentId),
        isNull(agentTemplates.deletedAt),
      ),
    }),
  ]);

  if (!(deployedAgent || agentTemplate)) {
    return {
      status: 404,
      body: {
        message: 'Agent not found',
      },
    };
  }

  if (agentTemplate) {
    if (context.request.source !== 'web') {
      return {
        status: 400,
        body: {
          message:
            'Cannot update agent template via API, please update in the UI',
        },
      };
    }

    const { name } = req.body;

    if (name) {
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        return {
          status: 400,
          body: {
            message: 'Name must be alphanumeric, with underscores or dashes',
          },
        };
      }

      if (name !== agentTemplate.name) {
        const exists = await db.query.agentTemplates.findFirst({
          where: and(
            eq(agentTemplates.organizationId, context.request.organizationId),
            eq(agentTemplates.projectId, agentTemplate.projectId),
            eq(agentTemplates.name, name),
            isNull(agentTemplates.deletedAt),
          ),
        });

        if (exists) {
          return {
            status: 409,
            body: {
              message: 'An agent with the same name already exists',
            },
          };
        }

        await db
          .update(agentTemplates)
          .set({ name })
          .where(eq(agentTemplates.id, agentId));
      }
    }
  }

  const response = await AgentsService.modifyAgent(
    {
      agentId,
      requestBody: req.body,
    },
    {
      user_id: context.request.lettaAgentsUserId,
    },
  );

  return {
    status: 200,
    body: response,
  };
}

type SearchDeployedAgentsRequest = ServerInferRequest<
  typeof sdkContracts.agents.searchDeployedAgents
>;

type SearchDeployedAgentsResponse = ServerInferResponses<
  typeof sdkContracts.agents.searchDeployedAgents
>;

const idToTemplateCache = new LRUCache<string, string>({
  max: 100,
  ttl: 1000 * 60 * 60 * 24,
});

async function searchDeployedAgents(
  req: SearchDeployedAgentsRequest,
  context: SDKContext,
): Promise<SearchDeployedAgentsResponse> {
  const { search = [], project_id, limit = 5, after } = req.body;

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
        const deployedAgentTemplate = await getDeployedTemplateByVersion(
          searchTerm.value,
          context.request.organizationId,
        );
        if (!deployedAgentTemplate) {
          return;
        }

        query.templateId = deployedAgentTemplate.id;

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
    },
    {
      user_id: context.request.lettaAgentsUserId,
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

      const template = await db.query.deployedAgentTemplates.findFirst({
        where: and(
          eq(
            deployedAgentTemplates.organizationId,
            context.request.organizationId,
          ),
          eq(deployedAgentTemplates.id, templateId),
          isNull(deployedAgentTemplates.deletedAt),
        ),
        with: {
          agentTemplate: true,
        },
      });

      if (!template?.agentTemplate?.name) {
        return agent;
      }

      const version = `${template.agentTemplate.name || 'unknown'}:${template.version}`;

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

type CreateTemplateFromAgentRequest = ServerInferRequest<
  typeof sdkContracts.agents.createTemplateFromAgent
>;

type CreateTemplateFromAgentResponse = ServerInferResponses<
  typeof sdkContracts.agents.createTemplateFromAgent
>;

async function createTemplateFromAgent(
  request: CreateTemplateFromAgentRequest,
  context: SDKContext,
): Promise<CreateTemplateFromAgentResponse> {
  const { agent_id: agentId } = request.params;
  const { lettaAgentsUserId, organizationId, userId } = context.request;
  const { project } = request.body;

  const foundProject = await db.query.projects.findFirst({
    where: and(
      eq(projects.organizationId, context.request.organizationId),
      eq(projects.slug, project || ''),
      isNull(projects.deletedAt),
    ),
  });

  if (!foundProject) {
    return {
      status: 404,
      body: {
        message: `Project ${project} not found`,
      },
    };
  }

  const agent = await AgentsService.retrieveAgent(
    {
      agentId,
    },
    {
      user_id: lettaAgentsUserId,
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

  const response = await createTemplate({
    projectId: foundProject.id,
    organizationId,
    userId,
    lettaAgentsId: lettaAgentsUserId,
    createAgentState: {
      llm_config: agent.llm_config,
      embedding_config: agent.embedding_config,
      system: agent.system,
      tool_ids: agent.tools.map((tool) => tool.id || '').filter(Boolean),
      memory_blocks: agent.memory.blocks.map((block) => {
        return {
          limit: block.limit,
          label: block.label || '',
          value: block.value,
        };
      }),
    },
  });

  return {
    status: 201,
    body: response,
  };
}

type GetAgentVariablesRequest = ServerInferRequest<
  typeof sdkContracts.agents.getAgentVariables
>;

type GetAgentVariablesResponse = ServerInferResponses<
  typeof sdkContracts.agents.getAgentVariables
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
    },
    {
      user_id: context.request.lettaAgentsUserId,
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
          context.request.organizationId,
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
  versionAgentTemplate,
  migrateAgent,
  listAgents,
  getAgentVariables,
  getAgentById,
  deleteAgent,
  updateAgent,
  searchDeployedAgents,
  createTemplateFromAgent,
};
