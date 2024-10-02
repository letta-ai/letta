import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { sdkContracts } from '$letta/sdk/contracts';
import * as Sentry from '@sentry/node';

import type { SDKContext } from '$letta/sdk/shared';
import {
  AgentsService,
  SourcesService,
  type UpdateAgentState,
} from '@letta-web/letta-agents-api';
import {
  agentTemplates,
  db,
  deployedAgents,
  deployedAgentTemplates,
  organizationPreferences,
} from '@letta-web/database';
import { and, desc, eq } from 'drizzle-orm';
import { createProject } from '$letta/web-api/projects/projectsRouter';
import { findUniqueAgentTemplateName } from '$letta/server';

export async function copyAgentById(
  agentId: string,
  lettaAgentsUserId: string
) {
  const [currentAgent, agentSources] = await Promise.all([
    AgentsService.getAgent(
      {
        agentId: agentId,
      },
      {
        user_id: lettaAgentsUserId,
      }
    ),
    AgentsService.getAgentSources(
      {
        agentId: agentId,
      },
      {
        user_id: lettaAgentsUserId,
      }
    ),
  ]);

  const nextAgent = await AgentsService.createAgent(
    {
      requestBody: {
        tools: currentAgent.tools,
        name: crypto.randomUUID(),
        embedding_config: currentAgent.embedding_config,
        description: currentAgent.description,
        memory: currentAgent.memory,
        user_id: currentAgent.user_id,
        llm_config: currentAgent.llm_config,
      },
    },
    {
      user_id: lettaAgentsUserId,
    }
  );

  if (!nextAgent?.id) {
    throw new Error('Failed to clone agent');
  }

  await Promise.all(
    agentSources.map(async (source) => {
      if (!source.id || !currentAgent.id) {
        return;
      }

      await SourcesService.attachAgentToSource(
        {
          agentId: nextAgent.id || '',
          sourceId: source.id,
        },
        {
          user_id: lettaAgentsUserId,
        }
      );
    })
  );

  return nextAgent;
}

type CreateAgentRequest = ServerInferRequest<
  typeof sdkContracts.agents.createAgent
>;

type CreateAgentResponse = ServerInferResponses<
  typeof sdkContracts.agents.createAgent
>;

export async function createAgent(
  req: CreateAgentRequest,
  context: SDKContext
): Promise<CreateAgentResponse> {
  const { organizationId, lettaAgentsUserId } = context.request;
  const { project_id, from_template, template, name, ...agent } = req.body;

  if (name) {
    if (!project_id) {
      return {
        status: 400,
        body: {
          message: 'project_id is required when providing a unique identifier',
        },
      };
    }

    const exists = await db.query.deployedAgents.findFirst({
      where: and(
        eq(deployedAgents.organizationId, organizationId),
        eq(deployedAgents.projectId, project_id),
        eq(deployedAgents.key, name)
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
  }

  if (from_template) {
    const [templateName, version] = from_template.split(':');

    const template = await db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, organizationId),
        eq(agentTemplates.name, templateName)
      ),
    });

    if (!template) {
      return {
        status: 404,
        body: {
          message: 'Template not found',
        },
      };
    }

    const deployedTemplate = await db.query.deployedAgentTemplates.findFirst({
      where: and(
        eq(deployedAgentTemplates.organizationId, organizationId),
        eq(deployedAgentTemplates.agentTemplateId, template.id),
        eq(deployedAgentTemplates.version, version)
      ),
    });

    if (!deployedTemplate) {
      return {
        status: 404,
        body: {
          message: `${version} of template ${templateName} not found`,
        },
      };
    }

    const copiedAgent = await copyAgentById(
      deployedTemplate.id,
      lettaAgentsUserId
    );

    if (!copiedAgent?.id) {
      return {
        status: 500,
        body: {
          message: 'Failed to create agent',
        },
      };
    }

    const lastDeployedAgent = await db.query.deployedAgents.findFirst({
      where: eq(deployedAgents.organizationId, organizationId),
      orderBy: [desc(deployedAgents.createdAt)],
    });

    const nextInternalAgentCountId =
      (lastDeployedAgent?.internalAgentCountId || 0) + 1;

    const key = name || `${template.id}-${nextInternalAgentCountId}`;

    await db.insert(deployedAgents).values({
      id: copiedAgent.id,
      projectId: template.projectId,
      key,
      internalAgentCountId: nextInternalAgentCountId,
      deployedAgentTemplateId: template.id,
      organizationId,
    });

    return {
      status: 201,
      body: copiedAgent,
    };
  }

  const response = await AgentsService.createAgent(
    {
      requestBody: {
        ...agent,
        name: crypto.randomUUID(),
      },
    },
    {
      user_id: lettaAgentsUserId,
    }
  );

  if (!response?.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent',
      },
    };
  }

  let projectId = project_id;

  if (!projectId) {
    const orgPrefResponse = await db.query.organizationPreferences.findFirst({
      where: eq(organizationPreferences.organizationId, organizationId),
      columns: {
        catchAllAgentsProjectId: true,
      },
    });

    if (!orgPrefResponse) {
      Sentry.captureMessage(
        `Organization preferences not found for organization ${organizationId}`
      );

      return {
        status: 500,
        body: {
          message: 'Failed to create agent',
        },
      };
    }

    projectId = orgPrefResponse.catchAllAgentsProjectId || '';

    const randomThreeDigitNumber = Math.floor(100 + Math.random() * 900);

    if (!projectId) {
      // create a catch-all project
      const catchAllRes = await createProject({
        body: {
          name: `Catch-all agents project ${randomThreeDigitNumber}`,
        },
      });

      if (catchAllRes.status !== 201) {
        Sentry.captureMessage(
          `Failed to make catch all project for - ${organizationId}`
        );

        return {
          status: 500,
          body: {
            message: 'Failed to create agent',
          },
        };
      }

      projectId = catchAllRes.body.id;
    }
  }

  if (template) {
    await db.insert(agentTemplates).values({
      organizationId,
      name: name || `Agent template ${response.id}`,
      id: response.id,
      projectId,
    });
  } else {
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

    await db.insert(deployedAgents).values({
      id: response.id,
      projectId,
      key: uniqueId,
      internalAgentCountId: nextInternalAgentCountId,
      deployedAgentTemplateId: '',
      organizationId,
    });
  }

  return {
    status: 201,
    body: response,
  };
}

type DeployAgentTemplateRequest = ServerInferRequest<
  typeof sdkContracts.agents.versionAgentTemplate
>;

type DeployAgentTemplateResponse = ServerInferResponses<
  typeof sdkContracts.agents.versionAgentTemplate
>;

export async function versionAgentTemplate(
  req: DeployAgentTemplateRequest,
  context: SDKContext
): Promise<DeployAgentTemplateResponse> {
  const { agentId } = req.params;

  const existingDeployedAgentTemplateCount =
    await db.query.deployedAgentTemplates.findMany({
      where: eq(deployedAgentTemplates.agentTemplateId, agentId),
      columns: {
        id: true,
      },
    });

  const [agentTemplate, deployedAgent] = await Promise.all([
    db.query.agentTemplates.findFirst({
      where: eq(agentTemplates.id, agentId),
    }),
    db.query.deployedAgentTemplates.findFirst({
      where: eq(deployedAgentTemplates.id, agentId),
    }),
  ]);

  if (!agentTemplate && !deployedAgent) {
    return {
      status: 404,
      body: {
        message: 'Agent not found',
      },
    };
  }

  const projectId = agentTemplate?.projectId || deployedAgent?.projectId || '';

  if (!projectId) {
    Sentry.captureMessage('Project not found for agent template');

    return {
      status: 500,
      body: {
        message: 'Failed to version agent template',
      },
    };
  }

  let agentTemplateId = agentTemplate?.id;
  let agentTemplateName = agentTemplate?.name;

  // if agent is a deployed agent, create a new agent template
  if (!agentTemplateId) {
    const copiedAgent = await copyAgentById(
      agentId,
      context.request.lettaAgentsUserId
    );

    if (!copiedAgent?.id) {
      return {
        status: 500,
        body: {
          message: 'Failed to version agent template',
        },
      };
    }

    const name = await findUniqueAgentTemplateName();

    agentTemplateName = name;

    await db.insert(agentTemplates).values({
      id: copiedAgent.id,
      name,
      organizationId: context.request.organizationId,
      projectId,
    });

    agentTemplateId = copiedAgent.id;
  }

  const version = `${existingDeployedAgentTemplateCount.length + 1}`;

  const createdAgent = await copyAgentById(
    agentId,
    context.request.lettaAgentsUserId
  );

  if (!createdAgent?.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to version agent template',
      },
    };
  }

  await db.insert(deployedAgentTemplates).values({
    id: createdAgent.id,
    projectId,
    organizationId: context.request.organizationId,
    agentTemplateId,
    version,
  });

  return {
    status: 201,
    body: {
      version: `${agentTemplateName}:${version}`,
    },
  };
}

type MigrateAgentRequest = ServerInferRequest<
  typeof sdkContracts.agents.migrateAgent
>;

type MigrateAgentResponse = ServerInferResponses<
  typeof sdkContracts.agents.migrateAgent
>;

export async function migrateAgent(
  req: MigrateAgentRequest,
  context: SDKContext
): Promise<MigrateAgentResponse> {
  const { to_template, preserve_core_memories } = req.body;
  const { agentId } = req.params;
  const { lettaAgentsUserId } = context.request;

  const [templateName, version] = to_template.split(':');

  if (!version) {
    return {
      status: 400,
      body: {
        message: `Please specify a version or add \`latest\` to the template name. Example: ${templateName}:latest`,
      },
    };
  }

  const rootAgentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.organizationId, context.request.organizationId),
      eq(agentTemplates.name, templateName)
    ),
  });

  if (!rootAgentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Template version provided does not exist',
      },
    };
  }

  const agentTemplate = await db.query.deployedAgentTemplates.findFirst({
    where: and(
      eq(deployedAgentTemplates.organizationId, context.request.organizationId),
      eq(deployedAgentTemplates.agentTemplateId, rootAgentTemplate.id),
      eq(deployedAgentTemplates.version, version)
    ),
  });

  if (!agentTemplate?.id) {
    return {
      status: 404,
      body: {
        message: 'Template version provided does not exist',
      },
    };
  }

  const [agentTemplateData, oldDatasources, newDatasources] = await Promise.all(
    [
      AgentsService.getAgent(
        {
          agentId: agentTemplate.id,
        },
        {
          user_id: lettaAgentsUserId,
        }
      ),
      AgentsService.getAgentSources(
        {
          agentId,
        },
        {
          user_id: lettaAgentsUserId,
        }
      ),
      AgentsService.getAgentSources(
        {
          agentId: agentTemplate.id,
        },
        {
          user_id: lettaAgentsUserId,
        }
      ),
    ]
  );

  const datasourcesToDetach = oldDatasources.filter(
    ({ id }) => !newDatasources.some((newDatasource) => newDatasource.id === id)
  );

  const datasourceToAttach = newDatasources.filter(
    (source) =>
      !oldDatasources.some((oldDatasource) => oldDatasource.id === source.id)
  );

  const requestBody: UpdateAgentState = {
    id: agentId,
    tools: agentTemplateData.tools,
  };

  if (!preserve_core_memories) {
    requestBody.memory = agentTemplateData.memory;
  }

  await AgentsService.updateAgent(
    {
      agentId,
      requestBody: requestBody,
    },
    {
      user_id: lettaAgentsUserId,
    }
  );

  await Promise.all([
    Promise.all(
      datasourceToAttach.map(async (datasource) => {
        return SourcesService.attachAgentToSource({
          agentId,
          sourceId: datasource.id || '',
        });
      })
    ),
    Promise.all(
      datasourcesToDetach.map(async (datasource) => {
        return SourcesService.detachAgentFromSource({
          agentId,
          sourceId: datasource.id || '',
        });
      })
    ),
  ]);

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type ListAgentsRequest = ServerInferRequest<
  typeof sdkContracts.agents.listAgents
>;

type ListAgentsResponse = ServerInferResponses<
  typeof sdkContracts.agents.listAgents
>;

export async function listAgents(
  req: ListAgentsRequest,
  context: SDKContext
): Promise<ListAgentsResponse> {
  const {
    project_id,
    template,
    template_version,
    name,
    limit = 5,
    offset = 0,
  } = req.query;

  if (template) {
    const queryBuilder = [
      eq(agentTemplates.organizationId, context.request.organizationId),
    ];

    if (project_id) {
      queryBuilder.push(eq(deployedAgents.projectId, project_id));
    }

    const query = await db.query.agentTemplates.findMany({
      where: and(...queryBuilder),
      limit,
      offset,
      orderBy: [desc(agentTemplates.createdAt)],
    });

    const allTemplateDetails = await Promise.all(
      query.map(async (template) => {
        return AgentsService.getAgent(
          {
            agentId: template.id,
          },
          {
            user_id: context.request.lettaAgentsUserId,
          }
        ).then((response) => {
          return {
            ...response,
            name: template.name,
          };
        });
      })
    );

    return {
      status: 200,
      body: allTemplateDetails,
    };
  }

  const queryBuilder = [
    eq(deployedAgents.organizationId, context.request.organizationId),
  ];

  if (project_id) {
    queryBuilder.push(eq(deployedAgents.projectId, project_id));
  }

  if (template_version) {
    const [templateKey, version] = template_version.split(':');

    const agentTemplate = await db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, context.request.organizationId),
        eq(agentTemplates.name, templateKey)
      ),
    });

    if (!agentTemplate) {
      return {
        status: 200,
        body: [],
      };
    }

    const deployedTemplate = await db.query.deployedAgentTemplates.findFirst({
      where: and(
        eq(
          deployedAgentTemplates.organizationId,
          context.request.organizationId
        ),
        eq(deployedAgentTemplates.agentTemplateId, agentTemplate.id),
        eq(deployedAgentTemplates.version, version)
      ),
    });

    if (!deployedTemplate) {
      return {
        status: 404,
        body: [],
      };
    }

    queryBuilder.push(
      eq(deployedAgents.deployedAgentTemplateId, deployedTemplate.id)
    );
  }

  if (name) {
    queryBuilder.push(eq(deployedAgents.key, name));
  }

  const query = await db.query.deployedAgents.findMany({
    where: and(...queryBuilder),
    limit,
    offset,
    orderBy: [desc(deployedAgents.createdAt)],
  });

  const allAgentsDetails = await Promise.all(
    query.map(async (agent) => {
      return AgentsService.getAgent(
        {
          agentId: agent.id,
        },
        {
          user_id: context.request.lettaAgentsUserId,
        }
      ).then((response) => {
        return {
          ...response,
          name: agent.key,
        };
      });
    })
  );

  return {
    status: 200,
    body: allAgentsDetails,
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
  context: SDKContext
): Promise<GetAgentByIdResponse> {
  const { agentId } = req.params;

  const [agent, deployedAgent, agentTemplate] = await Promise.all([
    AgentsService.getAgent(
      {
        agentId,
      },
      {
        user_id: context.request.lettaAgentsUserId,
      }
    ),
    db.query.deployedAgents.findFirst({
      where: and(
        eq(deployedAgents.organizationId, context.request.organizationId),
        eq(deployedAgents.id, agentId)
      ),
    }),
    db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, context.request.organizationId),
        eq(agentTemplates.id, agentId)
      ),
    }),
  ]);

  if (!agent) {
    return {
      status: 404,
      body: {
        message: 'Agent not found',
      },
    };
  }

  if (!deployedAgent && !agentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Agent not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      ...agent,
      name: deployedAgent?.key || agentTemplate?.name || '',
    },
  };
}

export const agentsRouter = {
  createAgent,
  versionAgentTemplate,
  migrateAgent,
  listAgents,
  getAgentById,
};
