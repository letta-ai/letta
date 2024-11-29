import type {
  ServerInferRequest,
  ServerInferResponseBody,
  ServerInferResponses,
} from '@ts-rest/core';
import type { sdkContracts } from '$letta/sdk/contracts';
import * as Sentry from '@sentry/node';

import type { SDKContext } from '$letta/sdk/shared';
import type { AgentState } from '@letta-web/letta-agents-api';
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
  deployedAgentVariables,
  organizationPreferences,
} from '@letta-web/database';
import { createProject } from '$letta/web-api/router';
import { and, desc, eq, isNull, like } from 'drizzle-orm';
import { findUniqueAgentTemplateName } from '$letta/server';
import {
  isTemplateNameAPremadeAgentTemplate,
  premadeAgentTemplates,
} from '$letta/sdk/agents/premadeAgentTemplates';

export function attachVariablesToTemplates(
  agentTemplate: AgentState,
  variables?: CreateAgentRequest['body']['variables']
) {
  const nextAgent = {
    ...agentTemplate,
  };

  nextAgent.memory.blocks.forEach((_, index) => {
    if (typeof nextAgent.memory.blocks[index]?.value === 'string') {
      // needs to be done or memory will rely on the existing block id
      const { id: _id, ...rest } = nextAgent.memory.blocks[index];
      nextAgent.memory.blocks[index] = rest;
      if (variables) {
        nextAgent.memory.blocks[index].value = nextAgent.memory.blocks[
          index
        ].value.replace(/{{(.*?)}}/g, (_m, p1) => {
          return variables?.[p1] || '';
        });
      }
    }
  });

  return {
    system: nextAgent.system,
    tool_names: nextAgent.tool_names,
    name: `name-${crypto.randomUUID()}`,
    embedding_config: nextAgent.embedding_config,
    memory: nextAgent.memory,
    llm_config: nextAgent.llm_config,
  };
}

export async function copyAgentById(
  agentId: string,
  lettaAgentsUserId: string,
  variables?: Record<string, string>
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

  const agentBody = attachVariablesToTemplates(currentAgent, variables);

  const nextAgent = await AgentsService.createAgent(
    {
      requestBody: {
        llm_config: agentBody.llm_config,
        embedding_config: agentBody.embedding_config,
        system: agentBody.system,
        tools: agentBody.tool_names,
        name: agentBody.name,
        memory_blocks: agentBody.memory.blocks.map((block) => {
          return {
            limit: block.limit,
            label: block.label || '',
            value: block.value,
          };
        }),
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

interface PrepareAgentForUserOptions {
  agentName: string;
  version?: string;
}

export function prepareAgentForUser(
  agent: AgentState,
  options: PrepareAgentForUserOptions
) {
  return {
    ...agent,
    name: options.agentName,
    ...(options.version ? { version: options.version } : {}),
  };
}

interface GetCatchAllProjectId {
  organizationId: string;
}

async function getCatchAllProjectId(args: GetCatchAllProjectId) {
  const { organizationId } = args;

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

    throw new Error('Organization preferences not found');
  }

  let projectId = orgPrefResponse.catchAllAgentsProjectId || '';

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

      throw new Error('Failed to create catch all project');
    }

    projectId = catchAllRes.body.id;
  }

  return projectId;
}

export async function createAgent(
  req: CreateAgentRequest,
  context: SDKContext
): Promise<CreateAgentResponse> {
  const { organizationId, lettaAgentsUserId } = context.request;
  const {
    project_id,
    from_template,
    template,
    variables,
    name: preName,
    ...agent
  } = req.body;

  let name = preName;

  if (name) {
    const projectId =
      project_id || (await getCatchAllProjectId({ organizationId }));

    if (template) {
      const exists = await db.query.agentTemplates.findFirst({
        where: and(
          eq(agentTemplates.organizationId, organizationId),
          eq(agentTemplates.projectId, projectId),
          eq(agentTemplates.name, name),
          isNull(agentTemplates.deletedAt)
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
    } else {
      const exists = await db.query.deployedAgents.findFirst({
        where: and(
          eq(deployedAgents.organizationId, organizationId),
          eq(deployedAgents.projectId, projectId),
          eq(deployedAgents.key, name),
          isNull(agentTemplates.deletedAt)
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
  } else {
    name = await findUniqueAgentTemplateName();
  }

  if (from_template) {
    const [templateName, version] = from_template.split(':');

    if (isTemplateNameAPremadeAgentTemplate(templateName)) {
      const premadeAgentTemplate = premadeAgentTemplates[templateName];

      if (!premadeAgentTemplate) {
        throw new Error('Premade agent template not found');
      }

      if (!project_id) {
        return {
          status: 400,
          body: {
            message:
              'project_id is required when creating an agent from a premade agent template',
          },
        };
      }

      if (!template) {
        return {
          status: 400,
          body: {
            message:
              'Cannot create a deployed agent from a premade agent template',
          },
        };
      }

      const response = await AgentsService.createAgent(
        {
          requestBody: {
            ...premadeAgentTemplate,
            llm_config: {
              model: 'gpt-4',
              model_endpoint_type: 'openai',
              model_endpoint: 'https://api.openai.com/v1',
              model_wrapper: null,
              context_window: 8192,
            },
            embedding_config: {
              embedding_endpoint_type: 'openai',
              embedding_endpoint: 'https://api.openai.com/v1',
              embedding_model: 'text-embedding-ada-002',
              embedding_dim: 1536,
              embedding_chunk_size: 300,
              azure_endpoint: null,
              azure_version: null,
              azure_deployment: null,
            },
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

      await db.insert(agentTemplates).values({
        organizationId,
        name: name,
        id: response.id,
        projectId: project_id,
      });

      return {
        status: 201,
        body: prepareAgentForUser(response, { agentName: name }),
      };
    }

    const agentTemplate = await db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, organizationId),
        eq(agentTemplates.name, templateName),
        isNull(agentTemplates.deletedAt)
      ),
    });

    if (!agentTemplate) {
      return {
        status: 404,
        body: {
          message: 'Template not found',
        },
      };
    }

    const isLatest = version === 'latest';
    const hasVersion = !!version;
    let agentTemplateIdToCopy = agentTemplate.id;

    const deployedTemplateQuery = [
      eq(deployedAgentTemplates.organizationId, organizationId),
      eq(deployedAgentTemplates.agentTemplateId, agentTemplate.id),
      isNull(deployedAgentTemplates.deletedAt),
    ];

    if (!isLatest) {
      deployedTemplateQuery.push(eq(deployedAgentTemplates.version, version));
    }

    if (hasVersion) {
      const deployedTemplate = await db.query.deployedAgentTemplates.findFirst({
        where: and(...deployedTemplateQuery),
        orderBy: [desc(deployedAgentTemplates.createdAt)],
      });

      if (!deployedTemplate) {
        return {
          status: 404,
          body: {
            message: `${version} of template ${templateName} not found`,
          },
        };
      }

      agentTemplateIdToCopy = deployedTemplate.id;
    } else {
      if (!template) {
        return {
          status: 400,
          body: {
            message:
              'You can only create a new agent from a specific version of a template or latest. Format <template-name>:<version>',
          },
        };
      }
    }

    const copiedAgent = await copyAgentById(
      agentTemplateIdToCopy,
      lettaAgentsUserId,
      variables
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

    const key = name || `${agentTemplate.id}-${nextInternalAgentCountId}`;

    const [deployedAgent] = await db
      .insert(deployedAgents)
      .values({
        id: copiedAgent.id,
        projectId: agentTemplate.projectId,
        key,
        rootAgentTemplateId: agentTemplate.id,
        internalAgentCountId: nextInternalAgentCountId,
        deployedAgentTemplateId: agentTemplateIdToCopy,
        organizationId,
      })
      .returning({ deployedAgentId: deployedAgents.id });

    await db.insert(deployedAgentVariables).values({
      deployedAgentId: deployedAgent.deployedAgentId,
      value: variables || {},
    });

    return {
      status: 201,
      body: prepareAgentForUser(copiedAgent, {
        agentName: name,
      }),
    };
  }

  const response = await AgentsService.createAgent(
    {
      requestBody: {
        ...agent,
        memory_blocks: agent.memory_blocks || [],
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

  const projectId =
    project_id || (await getCatchAllProjectId({ organizationId }));

  if (template) {
    await db.insert(agentTemplates).values({
      organizationId,
      name: name,
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

    const [createdAgent] = await db
      .insert(deployedAgents)
      .values({
        id: response.id,
        projectId,
        key: uniqueId,
        internalAgentCountId: nextInternalAgentCountId,
        deployedAgentTemplateId: '',
        organizationId,
      })
      .returning({ deployedAgentId: deployedAgents.id });

    await db.insert(deployedAgentVariables).values({
      deployedAgentId: createdAgent.deployedAgentId,
      value: variables || {},
    });
  }

  return {
    status: 201,
    body: prepareAgentForUser(response, {
      agentName: name,
    }),
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
  const { agent_id: agentId } = req.params;
  const { returnAgentId } = req.query;
  const { migrate_deployed_agents } = req.body;

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

  const deployedAgentTemplateId = createdAgent?.id;

  if (!deployedAgentTemplateId) {
    return {
      status: 500,
      body: {
        message: 'Failed to version agent template',
      },
    };
  }

  await db.insert(deployedAgentTemplates).values({
    id: deployedAgentTemplateId,
    projectId,
    organizationId: context.request.organizationId,
    agentTemplateId,
    version,
  });

  const response: ServerInferResponseBody<
    typeof sdkContracts.agents.versionAgentTemplate,
    201
  > = {
    version: `${agentTemplateName}:${version}`,
  };

  if (migrate_deployed_agents) {
    if (!agentTemplate?.id) {
      return {
        status: 400,
        body: {
          message: 'Cannot migrate deployed agents from a deployed agent',
        },
      };
    }

    const deployedAgentsList = await db.query.deployedAgents.findMany({
      where: eq(deployedAgents.rootAgentTemplateId, agentTemplate.id),
    });

    void Promise.all(
      deployedAgentsList.map(async (deployedAgent) => {
        const deployedAgentVariablesItem =
          await db.query.deployedAgentVariables.findFirst({
            where: eq(deployedAgentVariables.deployedAgentId, deployedAgent.id),
          });

        await updateAgentFromAgentId({
          variables: deployedAgentVariablesItem?.value || {},
          baseAgentId: deployedAgentTemplateId,
          agentToUpdateId: deployedAgent.id,
          lettaAgentsUserId: context.request.lettaAgentsUserId,
          preserveCoreMemories: false,
        });
      })
    );
  }

  if (returnAgentId) {
    response.agentId = createdAgent.id || '';
  }

  return {
    status: 201,
    body: response,
  };
}

interface UpdateAgentFromAgentId {
  preserveCoreMemories?: boolean;
  variables: Record<string, string>;
  baseAgentId: string;
  agentToUpdateId: string;
  lettaAgentsUserId: string;
}

export async function updateAgentFromAgentId(options: UpdateAgentFromAgentId) {
  const {
    preserveCoreMemories = false,
    variables,
    baseAgentId,
    agentToUpdateId,
    lettaAgentsUserId,
  } = options;

  const [agentTemplateData, oldDatasources, newDatasources] = await Promise.all(
    [
      AgentsService.getAgent(
        {
          agentId: baseAgentId,
        },
        {
          user_id: lettaAgentsUserId,
        }
      ),
      AgentsService.getAgentSources(
        {
          agentId: agentToUpdateId,
        },
        {
          user_id: lettaAgentsUserId,
        }
      ),
      AgentsService.getAgentSources(
        {
          agentId: baseAgentId,
        },
        {
          user_id: lettaAgentsUserId,
        }
      ),
      AgentsService.getAgentMemory(
        {
          agentId: agentToUpdateId,
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

  let requestBody: UpdateAgentState = {
    id: agentToUpdateId,
    tool_names: agentTemplateData.tool_names,
  };

  if (!preserveCoreMemories) {
    const { memory, ...rest } = attachVariablesToTemplates(
      agentTemplateData,
      variables
    );

    requestBody = {
      ...requestBody,
      ...rest,
    };

    if (memory) {
      await Promise.all(
        memory.blocks.map(async (block) => {
          if (!block.label) {
            return;
          }

          return AgentsService.updateAgentMemoryBlockByLabel(
            {
              agentId: agentToUpdateId,
              blockLabel: block.label,
              requestBody: {
                value: block.value,
                limit: block.limit,
              },
            },
            {
              user_id: lettaAgentsUserId,
            }
          );
        })
      );
    }
  }

  const agent = await AgentsService.updateAgent(
    {
      agentId: agentToUpdateId,
      requestBody,
    },
    {
      user_id: lettaAgentsUserId,
    }
  );

  await Promise.all([
    Promise.all(
      datasourceToAttach.map(async (datasource) => {
        return SourcesService.attachAgentToSource({
          agentId: agentToUpdateId,
          sourceId: datasource.id || '',
        });
      })
    ),
    Promise.all(
      datasourcesToDetach.map(async (datasource) => {
        return SourcesService.detachAgentFromSource({
          agentId: agentToUpdateId,
          sourceId: datasource.id || '',
        });
      })
    ),
  ]);

  return agent;
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
  let { variables } = req.body;
  const { agent_id: agentIdToMigrate } = req.params;
  const { lettaAgentsUserId } = context.request;

  const split = to_template.split(':');
  const templateName = split[0];
  let version = split[1];

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
      eq(agentTemplates.name, templateName),
      isNull(agentTemplates.deletedAt)
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

  if (version === 'latest') {
    const latestDeployedTemplate =
      await db.query.deployedAgentTemplates.findFirst({
        where: and(
          eq(
            deployedAgentTemplates.organizationId,
            context.request.organizationId
          ),
          eq(deployedAgentTemplates.agentTemplateId, rootAgentTemplate.id),
          isNull(deployedAgentTemplates.deletedAt)
        ),
        orderBy: [desc(deployedAgentTemplates.createdAt)],
      });

    if (!latestDeployedTemplate) {
      return {
        status: 404,
        body: {
          message: 'Template version provided does not exist',
        },
      };
    }

    version = latestDeployedTemplate.version;
  }

  const agentTemplate = await db.query.deployedAgentTemplates.findFirst({
    where: and(
      eq(deployedAgentTemplates.organizationId, context.request.organizationId),
      eq(deployedAgentTemplates.agentTemplateId, rootAgentTemplate.id),
      eq(deployedAgentTemplates.version, version),
      isNull(deployedAgentTemplates.deletedAt)
    ),
  });

  if (!variables) {
    const deployedAgentVariablesItem =
      await db.query.deployedAgentVariables.findFirst({
        where: eq(deployedAgentVariables.deployedAgentId, agentIdToMigrate),
      });

    variables = deployedAgentVariablesItem?.value || {};
  }

  if (!agentTemplate?.id) {
    return {
      status: 404,
      body: {
        message: 'Template version provided does not exist',
      },
    };
  }

  await updateAgentFromAgentId({
    variables: variables || {},
    baseAgentId: agentTemplate.id,
    agentToUpdateId: agentIdToMigrate,
    lettaAgentsUserId,
    preserveCoreMemories: preserve_core_memories,
  });

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
    by_version,
    name,
    include_version,
    search,
    limit = 5,
    offset = 0,
  } = req.query;

  if (template) {
    const queryBuilder = [
      eq(agentTemplates.organizationId, context.request.organizationId),
      isNull(agentTemplates.deletedAt),
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
          return prepareAgentForUser(response, {
            agentName: template.name,
          });
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
    isNull(deployedAgents.deletedAt),
  ];

  if (project_id) {
    queryBuilder.push(eq(deployedAgents.projectId, project_id));
  }

  if (search) {
    queryBuilder.push(like(deployedAgents.key, `%${search}%`));
  }

  if (by_version) {
    const [templateKey, version] = by_version.split(':');

    const agentTemplate = await db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, context.request.organizationId),
        eq(agentTemplates.name, templateKey),
        isNull(agentTemplates.deletedAt)
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
        isNull(deployedAgentTemplates.deletedAt),
        eq(deployedAgentTemplates.agentTemplateId, agentTemplate.id),
        ...(version ? [eq(deployedAgentTemplates.version, version)] : [])
      ),
    });

    if (!deployedTemplate) {
      return {
        status: 200,
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
    with: {
      deployedAgentTemplate: {
        columns: {
          version: true,
        },
      },
    },
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
        return prepareAgentForUser(response, {
          agentName: agent.key,
          version: include_version
            ? agent.deployedAgentTemplate?.version
            : undefined,
        });
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
  const { agent_id: agentId } = req.params;
  const { all } = req.query;

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
        isNull(deployedAgents.deletedAt),
        eq(deployedAgents.organizationId, context.request.organizationId),
        eq(deployedAgents.id, agentId)
      ),
    }),
    db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, context.request.organizationId),
        eq(agentTemplates.id, agentId),
        isNull(agentTemplates.deletedAt)
      ),
    }),
  ]);

  if (!all) {
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
  }

  return {
    status: 200,
    body: prepareAgentForUser(agent, {
      agentName: deployedAgent?.key || agentTemplate?.name || '',
    }),
  };
}

type DeleteAgentRequest = ServerInferRequest<
  typeof sdkContracts.agents.deleteAgent
>;

type DeleteAgentResponse = ServerInferResponses<
  typeof sdkContracts.agents.deleteAgent
>;

export async function deleteAgent(
  req: DeleteAgentRequest,
  context: SDKContext
): Promise<DeleteAgentResponse> {
  const { agent_id: agentId } = req.params;

  const [deployedAgent, agentTemplate] = await Promise.all([
    db.query.deployedAgents.findFirst({
      where: and(
        eq(deployedAgents.organizationId, context.request.organizationId),
        eq(deployedAgents.id, agentId),
        isNull(deployedAgents.deletedAt)
      ),
    }),
    db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, context.request.organizationId),
        eq(agentTemplates.id, agentId),
        isNull(agentTemplates.deletedAt)
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

  await AgentsService.deleteAgent(
    {
      agentId,
    },
    {
      user_id: context.request.lettaAgentsUserId,
    }
  );

  if (deployedAgent) {
    await db
      .update(deployedAgents)
      .set({ deletedAt: new Date() })
      .where(eq(deployedAgents.id, agentId));
  } else {
    await db
      .update(agentTemplates)
      .set({ deletedAt: new Date() })
      .where(eq(agentTemplates.id, agentId));
  }

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

export async function updateAgent(
  req: UpdateAgentRequest,
  context: SDKContext
): Promise<UpdateAgentResponse> {
  const { agent_id: agentId } = req.params;

  const [deployedAgent, agentTemplate] = await Promise.all([
    db.query.deployedAgents.findFirst({
      where: and(
        eq(deployedAgents.organizationId, context.request.organizationId),
        eq(deployedAgents.id, agentId),
        isNull(deployedAgents.deletedAt)
      ),
    }),
    db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, context.request.organizationId),
        eq(agentTemplates.id, agentId),
        isNull(agentTemplates.deletedAt)
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

  const { name, ...rest } = req.body;

  if (name) {
    // check if the name is unique and alphanumeric with underscores or dashes
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return {
        status: 400,
        body: {
          message: 'Name must be alphanumeric, with underscores or dashes',
        },
      };
    }

    if (deployedAgent) {
      if (name !== deployedAgent.key) {
        const exists = await db.query.deployedAgents.findFirst({
          where: and(
            eq(deployedAgents.organizationId, context.request.organizationId),
            eq(deployedAgents.projectId, deployedAgent.projectId),
            eq(deployedAgents.key, name),
            isNull(deployedAgents.deletedAt)
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
          .update(deployedAgents)
          .set({ key: name })
          .where(eq(deployedAgents.id, agentId));
      }
    } else if (agentTemplate) {
      if (name !== agentTemplate.name) {
        const exists = await db.query.agentTemplates.findFirst({
          where: and(
            eq(agentTemplates.organizationId, context.request.organizationId),
            eq(agentTemplates.projectId, agentTemplate.projectId),
            eq(agentTemplates.name, name),
            isNull(agentTemplates.deletedAt)
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

  let response: AgentState | undefined;

  if (Object.keys(rest).length > 0) {
    response = await AgentsService.updateAgent(
      {
        agentId,
        requestBody: rest,
      },
      {
        user_id: context.request.lettaAgentsUserId,
      }
    );

    if (!response?.id) {
      return {
        status: 500,
        body: {
          message: 'Failed to update agent',
        },
      };
    }
  } else {
    response = await AgentsService.getAgent(
      {
        agentId,
      },
      {
        user_id: context.request.lettaAgentsUserId,
      }
    );
  }

  return {
    status: 200,
    body: prepareAgentForUser(response, {
      agentName: deployedAgent?.key || agentTemplate?.name || '',
    }),
  };
}

export const agentsRouter = {
  createAgent,
  versionAgentTemplate,
  migrateAgent,
  listAgents,
  getAgentById,
  deleteAgent,
  updateAgent,
};
