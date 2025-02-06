import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type {
  ListAgentsData,
  sdkContracts,
} from '@letta-cloud/letta-agents-api';
import * as Sentry from '@sentry/node';
import { BlocksService } from '@letta-cloud/letta-agents-api';
import type { SDKContext } from '$web/sdk/shared';
import type { AgentState } from '@letta-cloud/letta-agents-api';
import { ToolsService } from '@letta-cloud/letta-agents-api';
import { AgentsService, type UpdateAgent } from '@letta-cloud/letta-agents-api';
import {
  agentTemplates,
  db,
  deployedAgentTemplates,
  deployedAgentVariables,
  organizationPreferences,
  projects,
} from '@letta-cloud/database';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { versionAgentTemplate } from './lib/versionAgentTemplate/versionAgentTemplate';
import {
  isTemplateNameAStarterKitId,
  STARTER_KITS,
} from '@letta-cloud/agent-starter-kits';
import { omit } from 'lodash';
import { migrateAgent } from '$web/sdk/agents/lib/migrateAgent/migrateAgent';
import { getDeployedTemplateByVersion } from '@letta-cloud/server-utils';
import { findUniqueAgentTemplateName } from '$web/server';
import { LRUCache } from 'lru-cache';
import { camelCaseKeys } from '@letta-cloud/generic-utils';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';

export function attachVariablesToTemplates(
  agentTemplate: AgentState,
  name?: string,
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
    name:
      name ||
      uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        length: 3,
        separator: '-',
      }),
    memory_blocks: memoryBlockValues,
  };
}

interface CopyAgentByIdOptions {
  memoryVariables?: Record<string, string>;
  toolVariables?: Record<string, string>;
  tags?: string[];
  templateVersionId?: string;
  baseTemplateId?: string;
  projectId?: string;
  name?: string;
}

export async function copyAgentById(
  baseAgentId: string,
  lettaAgentsUserId: string,
  options: CopyAgentByIdOptions = {},
) {
  const {
    memoryVariables,
    tags,
    name,
    toolVariables,
    projectId,
    templateVersionId,
    baseTemplateId,
  } = options;

  const [baseAgent, agentSources] = await Promise.all([
    AgentsService.retrieveAgent(
      {
        agentId: baseAgentId,
      },
      {
        user_id: lettaAgentsUserId,
      },
    ),
    AgentsService.listAgentSources(
      {
        agentId: baseAgentId,
      },
      {
        user_id: lettaAgentsUserId,
      },
    ),
  ]);

  const agentBody = attachVariablesToTemplates(
    baseAgent,
    name,
    memoryVariables,
  );

  const nextToolVariables = baseAgent.tool_exec_environment_variables?.reduce(
    (acc, tool) => {
      acc[tool.key] = toolVariables?.[tool.key] || '';

      return acc;
    },
    {} as Record<string, string>,
  );

  const nextAgent = await AgentsService.createAgent(
    {
      requestBody: {
        ...omit(baseAgent, omittedFieldsOnCopy),
        project_id: projectId,
        template_id: templateVersionId,
        base_template_id: baseTemplateId,
        tool_ids: agentBody.tool_ids,
        name: agentBody.name,
        // merge base tool variables as well as the tool variables passed in
        tool_exec_environment_variables: {
          ...nextToolVariables,
          ...toolVariables,
        },
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

  if (name) {
    if (template) {
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        return {
          status: 400,
          body: {
            message: 'Name must be alphanumeric, with underscores or dashes',
          },
        };
      }

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
            name,
            project_id: template ? 'templates' : projectId,
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
        await db.insert(deployedAgentVariables).values({
          deployedAgentId: response.id,
          value: memory_variables || {},
          organizationId,
        });

        return {
          status: 201,
          body: response,
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
        body: response,
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

    const copiedAgent = await (template
      ? copyAgentById(agentTemplateIdToCopy, lettaAgentsUserId, {
          name,
          tags: [],
          projectId: 'templates',
        })
      : copyAgentById(agentTemplateIdToCopy, lettaAgentsUserId, {
          name,
          tags: [],
          templateVersionId: agentTemplateIdToCopy,
          projectId,
          baseTemplateId: agentTemplate.id,
          memoryVariables: memory_variables || {},
          toolVariables: tool_exec_environment_variables || {},
        }));

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
        body: copiedAgent,
      };
    }

    await db.insert(deployedAgentVariables).values({
      deployedAgentId: copiedAgent.id,
      value: memory_variables || {},
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
        project_id: template ? 'templates' : projectId,
        ...agent,
        memory_blocks: agent.memory_blocks || [],
        name,
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
      name,
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
    await db.insert(deployedAgentVariables).values({
      deployedAgentId: response.id,
      value: memory_variables || {},
      organizationId,
    });
  }

  return {
    status: 201,
    body: response,
  };
}

interface UpdateAgentFromAgentId {
  preserveCoreMemories?: boolean;
  memoryVariables: Record<string, string>;
  baseAgentId: string;
  agentToUpdateId: string;
  toolVariables?: Record<string, string>;
  lettaAgentsUserId: string;
  baseTemplateId?: string;
  templateId?: string;
}

export const omittedFieldsOnCopy: Array<Partial<keyof AgentState>> = [
  'message_ids',
  'id',
  'tools',
  'created_at',
  'tool_rules',
  'updated_at',
  'created_by_id',
  'description',
  'organization_id',
  'last_updated_by_id',
  'metadata',
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
    baseTemplateId,
    templateId,
  } = options;

  const [agentTemplateData, existingAgent] = await Promise.all([
    AgentsService.retrieveAgent(
      {
        agentId: baseAgentId,
      },
      {
        user_id: lettaAgentsUserId,
      },
    ),
    AgentsService.retrieveAgent(
      {
        agentId: agentToUpdateId,
      },
      {
        user_id: lettaAgentsUserId,
      },
    ),
  ]);

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
      existingAgent.name,
      memoryVariables,
    );

    requestBody = {
      ...requestBody,
      ...rest,
    };

    if (memory_blocks) {
      const existingMemoryBlocks = existingAgent.memory.blocks;

      const memoryBlocksToDelete = existingMemoryBlocks.filter((block) => {
        return !memory_blocks.some(
          (newBlock) => newBlock.label === block.label,
        );
      }, []);

      const memoryBlocksToAdd = memory_blocks.filter((block) => {
        return !existingMemoryBlocks.some(
          (existingBlock) => existingBlock.label === block.label,
        );
      });

      const memoryBlocksToUpdate = memory_blocks.filter((block) => {
        return existingMemoryBlocks.some(
          (existingBlock) => existingBlock.label === block.label,
        );
      }, []);

      await Promise.all([
        ...memoryBlocksToDelete.map(async (block) => {
          return BlocksService.deleteBlock(
            {
              blockId: block.id || '',
            },
            {
              user_id: lettaAgentsUserId,
            },
          );
        }),
        ...memoryBlocksToAdd.map(async (block) => {
          if (!block.label) {
            return;
          }

          const createdBlock = await BlocksService.createBlock(
            {
              requestBody: {
                label: block.label,
                value: block.value,
                limit: block.limit,
              },
            },
            {
              user_id: lettaAgentsUserId,
            },
          );

          if (!createdBlock?.id) {
            throw new Error('Failed to create memory block');
          }

          return AgentsService.attachCoreMemoryBlock(
            {
              agentId: agentToUpdateId,
              blockId: createdBlock.id,
            },
            {
              user_id: lettaAgentsUserId,
            },
          );
        }),
        ...memoryBlocksToUpdate.map(async (block) => {
          if (!block.label) {
            return;
          }

          return AgentsService.modifyCoreMemoryBlock(
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
      ]);
    }
  }

  if (toolVariables) {
    requestBody = {
      ...requestBody,
      tool_exec_environment_variables: toolVariables,
    };
  }

  if (baseTemplateId) {
    requestBody = {
      ...requestBody,
      base_template_id: baseTemplateId,
    };
  }

  if (templateId) {
    requestBody = {
      ...requestBody,
      template_id: templateId,
    };
  }

  requestBody = {
    ...requestBody,
    source_ids: agentTemplateData.sources.map((source) => source.id || ''),
  };

  const agent = await AgentsService.modifyAgent(
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

export async function listAgents(
  req: ListAgentsRequest,
  context: SDKContext,
): Promise<ListAgentsResponse> {
  if (!req.query.project_id) {
    if (!process.env.IS_API_STABILITY_TEST) {
      return {
        status: 400,
        body: {
          message: 'project_id is required',
        },
      };
    }
  }

  const agents = await AgentsService.listAgents(camelCaseKeys(req.query), {
    user_id: context.request.lettaAgentsUserId,
  });

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

export async function deleteAgent(
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

export async function updateAgent(
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
  const { lettaAgentsUserId } = context.request;
  const { project } = request.body;

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
