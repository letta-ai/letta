import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { sdkContracts } from '@letta-cloud/letta-agents-api';
import * as Sentry from '@sentry/node';

import type { SDKContext } from '$web/sdk/shared';
import type {
  AgentState,
  OrderByValuesEnumType,
} from '@letta-cloud/letta-agents-api';
import { ToolsService } from '@letta-cloud/letta-agents-api';
import { AgentsService, type UpdateAgent } from '@letta-cloud/letta-agents-api';
import {
  agentTemplates,
  db,
  deployedAgents,
  deployedAgentTemplates,
  deployedAgentVariables,
  organizationPreferences,
  projects,
} from '@letta-cloud/database';
import { and, asc, count, desc, eq, isNull, like, ne, or } from 'drizzle-orm';
import { findUniqueAgentTemplateName } from '$web/server';

import { versionAgentTemplate } from './lib/versionAgentTemplate/versionAgentTemplate';
import {
  isTemplateNameAStarterKitId,
  STARTER_KITS,
} from '@letta-cloud/agent-starter-kits';
import { omit } from 'lodash';
import { migrateAgent } from '$web/sdk/agents/lib/migrateAgent/migrateAgent';

export function attachVariablesToTemplates(
  agentTemplate: AgentState,
  variables?: CreateAgentRequest['body']['memory_variables'],
) {
  const memoryBlockValues = agentTemplate.memory.blocks.map((block) => {
    if (variables && typeof block.value === 'string') {
      return {
        ...block,
        value: block.value.replace(/{{(.*?)}}/g, (_m, p1) => {
          return variables?.[p1] || '';
        }),
      };
    }

    return block;
  }, []);

  return {
    tool_ids:
      agentTemplate.tools?.map((tool) => tool.id || '').filter(Boolean) || [],
    name: `name-${crypto.randomUUID()}`,
    memory_blocks: memoryBlockValues,
  };
}

interface CopyAgentByIdOptions {
  memoryVariables?: Record<string, string>;
  toolVariables?: Record<string, string>;
  tags?: string[];
}

export async function copyAgentById(
  baseAgentId: string,
  lettaAgentsUserId: string,
  options: CopyAgentByIdOptions = {},
) {
  const { memoryVariables, tags, toolVariables } = options;

  const [baseAgent, agentSources] = await Promise.all([
    AgentsService.getAgent(
      {
        agentId: baseAgentId,
      },
      {
        user_id: lettaAgentsUserId,
      },
    ),
    AgentsService.getAgentSources(
      {
        agentId: baseAgentId,
      },
      {
        user_id: lettaAgentsUserId,
      },
    ),
  ]);

  const agentBody = attachVariablesToTemplates(baseAgent, memoryVariables);

  const nextAgent = await AgentsService.createAgent(
    {
      requestBody: {
        ...omit(baseAgent, omittedFieldsOnCopy),
        tool_ids: agentBody.tool_ids,
        name: agentBody.name,
        tool_exec_environment_variables:
          baseAgent.tool_exec_environment_variables?.reduce(
            (acc, tool) => {
              acc[tool.key] = toolVariables?.[tool.key] || '';

              return acc;
            },
            {} as Record<string, string>,
          ) || {},
        tags,
        memory_blocks: agentBody.memory_blocks.map((block) => {
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
    },
  );

  if (!nextAgent?.id) {
    throw new Error('Failed to clone agent');
  }

  await Promise.all(
    agentSources.map(async (source) => {
      if (!source.id || !baseAgent.id) {
        return;
      }

      await AgentsService.attachSourceToAgent(
        {
          agentId: nextAgent.id || '',
          sourceId: source.id,
        },
        {
          user_id: lettaAgentsUserId,
        },
      );
    }),
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
  projectId?: string;
  parentTemplateId?: string;
  parentTemplateName?: string;
  parentTemplate?: string;
  project?: string;
}

export function prepareAgentForUser(
  agent: AgentState,
  options: PrepareAgentForUserOptions,
) {
  return {
    ...agent,
    name: options.agentName,
    ...(options.version ? { version: options.version } : {}),
    metadata_: {
      ...agent.metadata_,
      ...(options.projectId ? { projectId: options.projectId } : {}),
      ...(options.parentTemplateId
        ? { parentTemplateId: options.parentTemplateId }
        : {}),
      ...(options.parentTemplateName
        ? { parentTemplateName: options.parentTemplateName }
        : {}),
      ...(options.project && !agent.metadata_?.project
        ? { project: options.project }
        : {}),
    },
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

interface GetProjectSlugById {
  organizationId: string;
  projectId: string | undefined;
}

async function getProjectSlugById(args: GetProjectSlugById) {
  const { organizationId, projectId } = args;

  if (!projectId) {
    return undefined;
  }

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.organizationId, organizationId),
      eq(projects.id, projectId),
      isNull(projects.deletedAt),
    ),
    columns: {
      slug: true,
    },
  });

  return project?.slug;
}

export async function createAgent(
  req: CreateAgentRequest,
  context: SDKContext,
): Promise<CreateAgentResponse> {
  const { organizationId, lettaAgentsUserId } = context.request;
  const {
    project,
    from_template,
    template,
    memory_variables,
    name: preName,
    tool_exec_environment_variables,
    ...agent
  } = req.body;

  let name = preName;
  let projectId: string | undefined = undefined;

  if (project) {
    const res = await db.query.projects.findFirst({
      where: and(
        eq(projects.organizationId, organizationId),
        eq(projects.slug, project),
        isNull(projects.deletedAt),
      ),
      columns: {
        id: true,
      },
    });

    if (!res?.id) {
      return {
        status: 404,
        body: {
          message:
            'Project slug is not associated with any known project in your organization',
        },
      };
    }

    projectId = res.id;
  }

  if (!projectId) {
    projectId = await getCatchAllProjectId({ organizationId });
  }

  let projectSlug =
    project ||
    (await getProjectSlugById({
      organizationId,
      projectId,
    }));

  if (name) {
    if (template) {
      const exists = await db.query.agentTemplates.findFirst({
        where: and(
          eq(agentTemplates.organizationId, organizationId),
          eq(agentTemplates.projectId, projectId),
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
    } else {
      const exists = await db.query.deployedAgents.findFirst({
        where: and(
          eq(deployedAgents.organizationId, organizationId),
          eq(deployedAgents.projectId, projectId),
          eq(deployedAgents.key, name),
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
    }
  } else {
    name = await findUniqueAgentTemplateName();
  }

  if (from_template) {
    const [templateName, version] = from_template.split(':');

    if (isTemplateNameAStarterKitId(templateName)) {
      const starterKit = STARTER_KITS[templateName];

      if (!starterKit) {
        throw new Error('Starter kit not found');
      }

      let toolIdsToAttach: string[] = [];

      if ('tools' in starterKit) {
        const existingTools = await ToolsService.listTools(
          {},
          {
            user_id: lettaAgentsUserId,
          },
        );

        const toolNameMap = (existingTools || []).reduce((acc, tool) => {
          acc.add(tool.name || '');

          return acc;
        }, new Set<string>());

        const toolsToCreate = starterKit.tools.filter((tool) => {
          return !toolNameMap.has(tool.name);
        });

        const toolResponse = await Promise.all(
          toolsToCreate.map((tool) => {
            return ToolsService.createTool(
              {
                requestBody: {
                  source_code: tool.code,
                  description: 'A custom tool',
                  name: tool.name,
                },
              },
              {
                user_id: lettaAgentsUserId,
              },
            );
          }),
        );

        toolIdsToAttach = toolResponse.map((tool) => tool.id || '');

        toolIdsToAttach = [
          ...toolIdsToAttach,
          ...(starterKit.tools || []).map((tool) => {
            const existingTool = existingTools?.find(
              (existingTool) => existingTool.name === tool.name,
            );

            return existingTool?.id || '';
          }),
        ].filter(Boolean);
      }

      const response = await AgentsService.createAgent(
        {
          requestBody: {
            ...starterKit.agentState,
            ...agent,
            tool_ids: toolIdsToAttach,
            llm_config: {
              model: 'gpt-4o-mini',
              model_endpoint_type: 'openai',
              model_endpoint: 'https://api.openai.com/v1',
              model_wrapper: null,
              context_window: 128000,
            },
            embedding_config: {
              embedding_endpoint_type: 'openai',
              embedding_endpoint: 'https://api.openai.com/v1',
              embedding_model: 'text-embedding-3-small',
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
        },
      );

      if (!response?.id) {
        return {
          status: 500,
          body: {
            message: 'Failed to create agent',
          },
        };
      }

      if (!template) {
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
            projectId: projectId,
            key: uniqueId,
            internalAgentCountId: nextInternalAgentCountId,
            deployedAgentTemplateId: '',
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
          body: prepareAgentForUser(response, {
            agentName: name,
            project: projectSlug,
          }),
        };
      }

      await db.insert(agentTemplates).values({
        organizationId,
        name: name,
        id: response.id,
        projectId: projectId,
      });

      await versionAgentTemplate(
        {
          params: {
            agent_id: response.id,
          },
          body: {},
          query: {},
        },
        context,
      );

      return {
        status: 201,
        body: prepareAgentForUser(response, {
          agentName: name,
          project: projectSlug,
        }),
      };
    }

    const agentTemplate = await db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, organizationId),
        eq(agentTemplates.name, templateName),
        isNull(agentTemplates.deletedAt),
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
      {
        tags: [],
        memoryVariables: memory_variables || {},
        toolVariables: tool_exec_environment_variables || {},
      },
    );

    if (!copiedAgent?.id) {
      return {
        status: 500,
        body: {
          message: 'Failed to create agent',
        },
      };
    }

    if (template) {
      if (!copiedAgent?.id) {
        return {
          status: 500,
          body: {
            message: 'Failed to create agent',
          },
        };
      }

      if (!projectId) {
        return {
          status: 400,
          body: {
            message:
              'project_id is required when creating an agent from a template',
          },
        };
      }

      await db.insert(agentTemplates).values({
        organizationId,
        name: name,
        id: copiedAgent.id,
        projectId: projectId,
      });

      await versionAgentTemplate(
        {
          params: {
            agent_id: copiedAgent.id,
          },
          body: {},
          query: {},
        },
        context,
      );

      return {
        status: 201,
        body: prepareAgentForUser(copiedAgent, {
          agentName: name,
          project: projectSlug,
        }),
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
      value: memory_variables || {},
      organizationId,
    });

    if (agentTemplate.projectId !== projectId) {
      projectSlug = await getProjectSlugById({
        organizationId: organizationId,
        projectId: agentTemplate.projectId,
      });
    }

    return {
      status: 201,
      body: prepareAgentForUser(copiedAgent, {
        agentName: name,
        project: projectSlug,
      }),
    };
  }

  const response = await AgentsService.createAgent(
    {
      requestBody: {
        ...agent,
        memory_blocks: agent.memory_blocks || [],
        name: crypto.randomUUID(),
        tool_exec_environment_variables: tool_exec_environment_variables,
      },
    },
    {
      user_id: lettaAgentsUserId,
    },
  );

  if (!response?.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent',
      },
    };
  }

  if (template) {
    await db.insert(agentTemplates).values({
      organizationId,
      name: name,
      id: response.id,
      projectId,
    });

    await versionAgentTemplate(
      {
        params: {
          agent_id: response.id,
        },
        body: {},
        query: {},
      },
      context,
    );
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
      value: memory_variables || {},
      organizationId,
    });
  }

  return {
    status: 201,
    body: prepareAgentForUser(response, {
      agentName: name,
      project: projectSlug,
    }),
  };
}
interface UpdateAgentFromAgentId {
  preserveCoreMemories?: boolean;
  memoryVariables: Record<string, string>;
  baseAgentId: string;
  agentToUpdateId: string;
  toolVariables?: Record<string, string>;
  lettaAgentsUserId: string;
}

export const omittedFieldsOnCopy: Array<Partial<keyof AgentState>> = [
  'message_ids',
  'id',
  'tools',
  'created_at',
  'updated_at',
  'created_by_id',
  'description',
  'organization_id',
  'last_updated_by_id',
  'metadata_',
  'memory',
];

export async function updateAgentFromAgentId(options: UpdateAgentFromAgentId) {
  const {
    preserveCoreMemories = false,
    memoryVariables,
    baseAgentId,
    agentToUpdateId,
    toolVariables,
    lettaAgentsUserId,
  } = options;

  const agentTemplateData = await AgentsService.getAgent(
    {
      agentId: baseAgentId,
    },
    {
      user_id: lettaAgentsUserId,
    },
  );

  let requestBody: UpdateAgent = {
    ...omit(agentTemplateData, omittedFieldsOnCopy),
    tool_ids: agentTemplateData.tools
      .map((tool) => tool.id || '')
      .filter(Boolean),
    tool_exec_environment_variables:
      agentTemplateData.tool_exec_environment_variables?.reduce(
        (acc, tool) => {
          acc[tool.key] = tool.value;

          return acc;
        },
        {} as Record<string, string>,
      ) || {},
  };

  if (!preserveCoreMemories) {
    const { memory_blocks, ...rest } = attachVariablesToTemplates(
      agentTemplateData,
      memoryVariables,
    );

    requestBody = {
      ...requestBody,
      ...rest,
    };

    if (memory_blocks) {
      await Promise.all(
        memory_blocks.map(async (block) => {
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
            },
          );
        }),
      );
    }
  }

  if (toolVariables) {
    requestBody = {
      ...requestBody,
      tool_exec_environment_variables: toolVariables,
    };
  }

  requestBody = {
    ...requestBody,
    source_ids: agentTemplateData.sources.map((source) => source.id || ''),
  };

  const agent = await AgentsService.updateAgent(
    {
      agentId: agentToUpdateId,
      requestBody,
    },
    {
      user_id: lettaAgentsUserId,
    },
  );

  return agent;
}

type ListAgentsRequest = ServerInferRequest<
  typeof sdkContracts.agents.listAgents
>;

type ListAgentsResponse = ServerInferResponses<
  typeof sdkContracts.agents.listAgents
>;

interface QueryAgentsOptions {
  include_version: boolean;
  orderBy?: Array<ReturnType<typeof desc>>;
  limit: number;
  offset: number;
  context: SDKContext;
  queryBuilder: any[];
}

async function queryAgents(options: QueryAgentsOptions) {
  const { include_version, limit, orderBy, offset, context, queryBuilder } =
    options;

  const query = await db.query.deployedAgents.findMany({
    where: and(...queryBuilder),
    limit,
    offset,
    orderBy: orderBy || [desc(deployedAgents.createdAt)],
    with: {
      deployedAgentTemplate: {
        columns: {
          version: true,
        },
        with: {
          agentTemplate: {
            columns: {
              name: true,
            },
          },
        },
      },
    },
  });

  return Promise.all(
    query.map((agent) =>
      Promise.all([
        AgentsService.getAgent(
          {
            agentId: agent.id,
          },
          {
            user_id: context.request.lettaAgentsUserId,
          },
        ),
        getProjectSlugById({
          organizationId: context.request.organizationId,
          projectId: agent.projectId,
        }),
      ]).then(([response, projectSlug]) =>
        prepareAgentForUser(response, {
          agentName: agent.key,
          version: include_version
            ? `${agent.deployedAgentTemplate?.agentTemplate?.name}:${agent.deployedAgentTemplate?.version}`
            : undefined,
          project: projectSlug,
        }),
      ),
    ),
  );
}

interface AgentMetadataLookerOptions {
  builderConfig: QueryAgentsOptions;
  tags?: string[];
}

async function agentMetadataLooker(
  options: AgentMetadataLookerOptions,
): Promise<AgentState[]> {
  const { builderConfig, tags } = options;

  const agents = await queryAgents(builderConfig);

  if (agents.length === 0) {
    return [];
  }

  if (!tags) {
    return agents;
  }

  // look for agents with the tags that match
  const remainingAgents = agents.filter((agent) => {
    return tags.every((tag) => {
      return agent.tags.includes(tag);
    });
  }, []);

  // if the remaining agents are less than the limit, run agentMetadataLooker again with new offset

  if (remainingAgents.length === builderConfig.limit) {
    return remainingAgents;
  }

  return [
    ...remainingAgents,
    ...(await agentMetadataLooker({
      builderConfig: {
        ...builderConfig,
        offset: builderConfig.offset + builderConfig.limit,
      },
      tags,
    })),
  ];
}

export async function listAgents(
  req: ListAgentsRequest,
  context: SDKContext,
): Promise<ListAgentsResponse> {
  const {
    project_id,
    template,
    by_version,
    name,
    tags,
    include_version,
    search,
    limit = 5,
    offset = 0,
  } = req.query;

  if (!template && !project_id && !search && !by_version) {
    const res = await AgentsService.listAgents(
      {
        ...req.query,
      },
      {
        user_id: context.request.lettaAgentsUserId,
      },
    );

    return {
      status: 200,
      body: res,
    };
  }

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
      query.map((template) =>
        Promise.all([
          AgentsService.getAgent(
            {
              agentId: template.id,
            },
            {
              user_id: context.request.lettaAgentsUserId,
            },
          ),
          getProjectSlugById({
            organizationId: context.request.organizationId,
            projectId: template.projectId,
          }),
        ]).then(([response, projectSlug]) => {
          return prepareAgentForUser(response, {
            agentName: template.name,
            project: projectSlug,
          });
        }),
      ),
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
        isNull(agentTemplates.deletedAt),
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
          context.request.organizationId,
        ),
        isNull(deployedAgentTemplates.deletedAt),
        eq(deployedAgentTemplates.agentTemplateId, agentTemplate.id),
        ...(version ? [eq(deployedAgentTemplates.version, version)] : []),
      ),
    });

    if (!deployedTemplate) {
      return {
        status: 200,
        body: [],
      };
    }

    queryBuilder.push(
      eq(deployedAgents.deployedAgentTemplateId, deployedTemplate.id),
    );
  }

  if (name) {
    queryBuilder.push(eq(deployedAgents.key, name));
  }

  const allAgentsDetails = await agentMetadataLooker({
    builderConfig: {
      include_version: !!include_version,
      limit: Number(limit),
      offset: Number(offset),
      context,
      queryBuilder,
    },
    tags,
  });

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
  context: SDKContext,
): Promise<GetAgentByIdResponse> {
  const { agent_id: agentId } = req.params;
  const { all, template } = req.query;

  const onlyLoadDeployedAgent = template === false;
  const onlyLoadAgentTemplate = template === true;

  const [agent, deployedAgent, agentTemplate] = await Promise.all([
    AgentsService.getAgent(
      {
        agentId,
      },
      {
        user_id: context.request.lettaAgentsUserId,
      },
    ),
    !onlyLoadAgentTemplate
      ? db.query.deployedAgents.findFirst({
          where: and(
            isNull(deployedAgents.deletedAt),
            eq(deployedAgents.organizationId, context.request.organizationId),
            eq(deployedAgents.id, agentId),
          ),
          with: {
            deployedAgentTemplate: {
              columns: {
                version: true,
              },
              with: {
                agentTemplate: {
                  columns: {
                    name: true,
                  },
                },
              },
            },
          },
        })
      : null,
    !onlyLoadDeployedAgent
      ? db.query.agentTemplates.findFirst({
          where: and(
            eq(agentTemplates.organizationId, context.request.organizationId),
            eq(agentTemplates.id, agentId),
            isNull(agentTemplates.deletedAt),
          ),
        })
      : null,
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

  const parentTemplateName = deployedAgent?.deployedAgentTemplate?.agentTemplate
    ?.name
    ? `${deployedAgent?.deployedAgentTemplate?.agentTemplate?.name}:${deployedAgent?.deployedAgentTemplate?.version}`
    : '';
  const projectSlug = agent?.metadata_?.project
    ? (agent.metadata_.project as string)
    : await getProjectSlugById({
        organizationId: context.request.organizationId,
        projectId: deployedAgent?.projectId || agentTemplate?.projectId,
      });

  return {
    status: 200,
    body: prepareAgentForUser(agent, {
      projectId: deployedAgent?.projectId || '',
      agentName: deployedAgent?.key || agentTemplate?.name || '',
      parentTemplateId: deployedAgent?.deployedAgentTemplateId || '',
      parentTemplateName: parentTemplateName,
      parentTemplate: deployedAgent?.deployedAgentTemplateId || '',
      project: projectSlug,
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
  context: SDKContext,
): Promise<DeleteAgentResponse> {
  const { agent_id: agentId } = req.params;

  const [deployedAgent, agentTemplate] = await Promise.all([
    db.query.deployedAgents.findFirst({
      where: and(
        eq(deployedAgents.organizationId, context.request.organizationId),
        eq(deployedAgents.id, agentId),
        isNull(deployedAgents.deletedAt),
      ),
    }),
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

  await AgentsService.deleteAgent(
    {
      agentId,
    },
    {
      user_id: context.request.lettaAgentsUserId,
    },
  );

  if (deployedAgent) {
    // await db
    //   .update(deployedAgents)
    //   .set({ deletedAt: new Date() })
    //   .where(eq(deployedAgents.id, agentId));
    // hard delete for now
    await db.delete(deployedAgents).where(eq(deployedAgents.id, agentId));
  } else {
    // await db
    //   .update(agentTemplates)
    //   .set({ deletedAt: new Date() })
    //   .where(eq(agentTemplates.id, agentId));
    // hard delete for now
    await db.delete(agentTemplates).where(eq(agentTemplates.id, agentId));
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
  context: SDKContext,
): Promise<UpdateAgentResponse> {
  const { agent_id: agentId } = req.params;

  const [deployedAgent, agentTemplate] = await Promise.all([
    db.query.deployedAgents.findFirst({
      where: and(
        eq(deployedAgents.organizationId, context.request.organizationId),
        eq(deployedAgents.id, agentId),
        isNull(deployedAgents.deletedAt),
      ),
    }),
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
            isNull(deployedAgents.deletedAt),
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

  let response: AgentState | undefined;

  if (Object.keys(rest).length > 0) {
    response = await AgentsService.updateAgent(
      {
        agentId,
        requestBody: rest,
      },
      {
        user_id: context.request.lettaAgentsUserId,
      },
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
      },
    );
  }

  const projectSlug = response?.metadata_?.project
    ? (response.metadata_.project as string)
    : await getProjectSlugById({
        organizationId: context.request.organizationId,
        projectId: deployedAgent?.projectId || agentTemplate?.projectId,
      });

  return {
    status: 200,
    body: prepareAgentForUser(response, {
      agentName: deployedAgent?.key || agentTemplate?.name || '',
      project: projectSlug,
    }),
  };
}

type SearchDeployedAgentsRequest = ServerInferRequest<
  typeof sdkContracts.agents.searchDeployedAgents
>;

type SearchDeployedAgentsResponse = ServerInferResponses<
  typeof sdkContracts.agents.searchDeployedAgents
>;

async function searchDeployedAgents(
  req: SearchDeployedAgentsRequest,
  context: SDKContext,
): Promise<SearchDeployedAgentsResponse> {
  const {
    search = [],
    combinator = 'AND',
    project_id,
    limit = 5,
    offset,
  } = req.body;

  const combinatorFunction = combinator === 'AND' ? and : or;
  const query = [
    eq(deployedAgents.organizationId, context.request.organizationId),
  ];

  let isDefaultOrderBy = true;
  let orderBy = [desc(deployedAgents.createdAt)];

  let tags: string[] | undefined;

  await Promise.all(
    search.map(async (searchTerm) => {
      if (searchTerm.field === 'order_by') {
        if (isDefaultOrderBy) {
          isDefaultOrderBy = false;
          orderBy = [];
        }

        const order = searchTerm.direction === 'asc' ? asc : desc;

        const orderByMap: Record<
          OrderByValuesEnumType,
          ReturnType<typeof desc>
        > = {
          created_at: order(deployedAgents.createdAt),
          updated_at: order(deployedAgents.updatedAt),
        };

        if (orderByMap[searchTerm.value]) {
          orderBy.push(orderByMap[searchTerm.value]);
        }

        return;
      }

      if (searchTerm.field === 'name') {
        if (searchTerm.operator === 'eq') {
          query.push(eq(deployedAgents.key, searchTerm.value));
        } else if (searchTerm.operator === 'neq') {
          query.push(ne(deployedAgents.key, searchTerm.value));
        } else if (searchTerm.operator === 'contains') {
          query.push(like(deployedAgents.key, `%${searchTerm.value || ''}%`));
        }
      }

      if (searchTerm.field === 'tags') {
        tags = searchTerm.value;
      }

      if (searchTerm.field === 'version') {
        const [name, versionNumber] = searchTerm.value.split(':');
        const agentTemplate = await db.query.agentTemplates.findFirst({
          where: and(
            eq(agentTemplates.organizationId, context.request.organizationId),
            eq(agentTemplates.name, name),
            isNull(agentTemplates.deletedAt),
          ),
        });

        if (!agentTemplate) {
          return;
        }

        const deployedAgentTemplate = await (() => {
          if (versionNumber === 'latest') {
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
                eq(deployedAgentTemplates.version, versionNumber),
                eq(deployedAgentTemplates.agentTemplateId, agentTemplate.id),
                isNull(deployedAgentTemplates.deletedAt),
              ),
            });
          }
        })();

        if (!deployedAgentTemplate) {
          return;
        }

        query.push(
          eq(deployedAgents.deployedAgentTemplateId, deployedAgentTemplate.id),
        );

        return;
      }
    }),
  );

  const queryBuilder = [
    combinatorFunction(...query),
    eq(deployedAgents.organizationId, context.request.organizationId),
    isNull(deployedAgents.deletedAt),
    ...(project_id ? [eq(deployedAgents.projectId, project_id)] : []),
  ];

  if (tags?.length) {
    const result = await agentMetadataLooker({
      builderConfig: {
        include_version: true,
        limit: Number(limit),
        offset: Number(offset),
        orderBy,
        context,
        queryBuilder,
      },
      tags,
    });

    return {
      status: 200,
      body: {
        agents: result,
        hasNextPage: result.length > limit,
      },
    };
  }

  const where = and(...queryBuilder);

  const [result, [totalCount]] = await Promise.all([
    db.query.deployedAgents.findMany({
      where,
      limit: limit + 1,
      offset,
      orderBy,
      with: {
        deployedAgentTemplate: {
          with: {
            agentTemplate: {
              columns: {
                name: true,
              },
            },
          },
          columns: {
            version: true,
          },
        },
      },
    }),
    db.select({ count: count() }).from(deployedAgents).where(where),
  ]);

  const allAgentsDetails = await Promise.all(
    result.slice(0, limit).map((agent) =>
      Promise.all([
        AgentsService.getAgent(
          {
            agentId: agent.id,
          },
          {
            user_id: context.request.lettaAgentsUserId,
          },
        ),
        getProjectSlugById({
          organizationId: context.request.organizationId,
          projectId: agent.projectId,
        }),
      ]).then(([response, projectSlug]) =>
        prepareAgentForUser(response, {
          agentName: agent.key,
          version: agent.deployedAgentTemplate?.version
            ? `${
                agent.deployedAgentTemplate?.agentTemplate?.name || 'unknown'
              }:${agent.deployedAgentTemplate?.version}`
            : '',
          project: projectSlug,
        }),
      ),
    ),
  );

  return {
    status: 200,
    body: {
      agents: allAgentsDetails,
      hasNextPage: result.length > limit,
      totalCount: totalCount.count,
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
  const { lettaAgentsUserId } = context.request;
  const { project } = request.body;

  const agent = await AgentsService.getAgent(
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

  const response = await createAgent(
    {
      body: {
        project,
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
        template: true,
      },
    },
    context,
  );

  if (response.status !== 201) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent template',
      },
    };
  }

  return {
    status: 201,
    body: response.body,
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

  const agent = await AgentsService.getAgent(
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
