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
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';

export async function copyAgentById(
  agentId: string,
  name: string,
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
        name: name,
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
  const { project_id, template_key, template, unique_identifier, ...agent } =
    req.body;

  if (unique_identifier) {
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
        eq(deployedAgents.key, unique_identifier)
      ),
    });

    if (exists) {
      return {
        status: 409,
        body: {
          message: 'An agent with the same unique identifier already exists',
        },
      };
    }
  }

  if (template_key) {
    const template = await db.query.deployedAgentTemplates.findFirst({
      where: and(
        eq(deployedAgentTemplates.organizationId, organizationId),
        eq(deployedAgentTemplates.key, template_key)
      ),
    });

    if (!template) {
      return {
        status: 404,
        body: {
          message: 'Template key not found',
        },
      };
    }

    const copiedAgent = await copyAgentById(
      template.id,
      `Deployed - ${template.key}`,
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

    const key =
      unique_identifier || `${template.id}-${nextInternalAgentCountId}`;

    await db.insert(deployedAgents).values({
      id: copiedAgent.id,
      projectId: template.projectId,
      key,
      internalAgentCountId: nextInternalAgentCountId,
      deployedAgentTemplateKey: template.key,
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
      requestBody: agent,
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
      name: agent.name || 'Unnamed agent',
      id: response.id,
      projectId,
    });
  } else {
    let uniqueId = unique_identifier;
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
      deployedAgentTemplateKey: '',
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

function randomFourDigitNumber() {
  return Math.floor(1000 + Math.random() * 9000);
}

async function findUniqueDeployedAgentTemplateName(
  organizationId: string,
  retries = 0
) {
  let name = uniqueNamesGenerator({
    dictionaries: [adjectives, adjectives, animals, colors],
    length: 4,
    separator: '-',
  });

  if (retries > 3) {
    name += `-${randomFourDigitNumber()}`;
  }

  if (retries > 5) {
    throw new Error('Failed to find unique name');
  }

  const agentTemplate = await db.query.deployedAgentTemplates.findFirst({
    where: and(
      eq(deployedAgentTemplates.key, name),
      eq(deployedAgentTemplates.organizationId, organizationId)
    ),
  });

  if (!agentTemplate) {
    return name;
  }

  return findUniqueDeployedAgentTemplateName(organizationId, retries + 1);
}

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

  // if agent is a deployed agent, create a new agent template
  if (!agentTemplateId) {
    const copiedAgent = await copyAgentById(
      agentId,
      `Template from ${agentId}`,
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

    await db.insert(agentTemplates).values({
      id: copiedAgent.id,
      name: `Agent template created from ${agentId}`,
      organizationId: context.request.organizationId,
      projectId,
    });

    agentTemplateId = copiedAgent.id;
  }

  const version = `${existingDeployedAgentTemplateCount.length + 1}`;

  const templateKey = await findUniqueDeployedAgentTemplateName(
    context.request.organizationId
  );

  const createdAgent = await copyAgentById(
    agentId,
    templateKey,
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
    key: templateKey,
    organizationId: context.request.organizationId,
    agentTemplateId,
    version,
  });

  return {
    status: 201,
    body: {
      template_key: templateKey,
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
  const { template_key, preserve_core_memories } = req.body;
  const { agentId } = req.params;
  const { lettaAgentsUserId } = context.request;

  const agentTemplate = await db.query.deployedAgentTemplates.findFirst({
    where: eq(deployedAgentTemplates.key, template_key),
  });

  const [agentTemplateData, oldDatasources, newDatasources] = await Promise.all(
    [
      AgentsService.getAgent(
        {
          agentId: agentTemplate?.id || '',
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
          agentId: agentTemplate?.id || '',
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
    template_key,
    unique_identifier,
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
        );
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

  if (template_key) {
    queryBuilder.push(
      eq(deployedAgents.deployedAgentTemplateKey, template_key)
    );
  }

  if (unique_identifier) {
    queryBuilder.push(eq(deployedAgents.key, unique_identifier));
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
      );
    })
  );

  return {
    status: 200,
    body: allAgentsDetails,
  };
}

export const agentsRouter = {
  createAgent,
  versionAgentTemplate,
  migrateAgent,
  listAgents,
};
