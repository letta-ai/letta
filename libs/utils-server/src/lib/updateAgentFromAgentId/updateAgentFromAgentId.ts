import {
  AgentsService,
  BlocksService,
  isAPIError,
} from '@letta-cloud/sdk-core';
import type { AgentState, UpdateAgent } from '@letta-cloud/sdk-core';
import * as lodash from 'lodash';
import { attachVariablesToTemplates } from '../attachVariablesToTemplates/attachVariablesToTemplates';

interface UpdateAgentFromAgentId {
  preserveCoreMemories?: boolean;
  preserveToolVariables?: boolean;
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
  'identity_ids',
  'updated_at',
  'tool_exec_environment_variables',
  'created_by_id',
  'description',
  'last_updated_by_id',
  'metadata',
  'memory',
  'name',
  'tags',
];

export async function updateAgentFromAgentId(options: UpdateAgentFromAgentId) {
  const {
    preserveCoreMemories = false,
    preserveToolVariables = false,
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
    ).catch((res) => {
      if (isAPIError(res)) {
        console.error('API Error retrieving agent from template:', res.status);
        console.error('API Error retrieving agent from template:', res.body);
      }

      throw res;
    }),
    AgentsService.retrieveAgent(
      {
        agentId: agentToUpdateId,
      },
      {
        user_id: lettaAgentsUserId,
      },
    ).catch((res) => {
      if (isAPIError(res)) {
        console.error('API Error retrieving agent from template:', res.status);
        console.error('API Error retrieving agent from template:', res.body);
      }

      throw res;
    }),
  ]);

  let requestBody: UpdateAgent = {
    ...lodash.omit(agentTemplateData, omittedFieldsOnCopy),
    tool_ids: agentTemplateData.tools
      .map((tool) => tool.id || '')
      .filter(Boolean),
  };

  if (!preserveToolVariables) {
    requestBody.tool_exec_environment_variables =
      agentTemplateData.tool_exec_environment_variables?.reduce(
        (acc, tool) => {
          acc[tool.key] = tool.value;

          return acc;
        },
        {} as Record<string, string>,
      ) || {};
  } else {
    // existing agent tool map
    const existingToolMap: Record<string, string> = {};
    existingAgent.tool_exec_environment_variables?.forEach((tool) => {
      if (typeof tool.key === 'string') {
        existingToolMap[tool.key] = tool.value;
      }
    });

    // only add tool variables that are not already in the agent
    // as well as removing any tool variables that are not in the template
    requestBody.tool_exec_environment_variables =
      agentTemplateData.tool_exec_environment_variables?.reduce(
        (acc, tool) => {
          // if existing agent has the tool variable, keep it
          if (
            typeof tool.key === 'string' &&
            existingToolMap[tool.key] !== undefined
          ) {
            acc[tool.key] = existingToolMap[tool.key];
          } else {
            // otherwise, use the template's tool variable
            acc[tool.key] = tool.value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
  }

  if (!preserveCoreMemories) {
    const { memory_blocks, tool_ids } = attachVariablesToTemplates(
      agentTemplateData,
      memoryVariables,
    );

    requestBody = {
      ...requestBody,
      tool_ids,
    };

    if (memory_blocks) {
      const existingMemoryBlocks = existingAgent.memory.blocks;

      // Create maps with label as key for efficient lookups
      const existingBlockMap = new Map();
      existingMemoryBlocks.forEach((block) => {
        if (block.label) {
          existingBlockMap.set(block.label, block);
        }
      });

      const newBlockMap = new Map();
      memory_blocks.forEach((block) => {
        if (block.label) {
          newBlockMap.set(block.label, block);
        }
      });

      // Create a set of all unique labels from both maps
      const allLabels = new Set<string>([
        ...existingBlockMap.keys(),
        ...newBlockMap.keys(),
      ]);

      const memoryBlocksToDelete: typeof existingMemoryBlocks = [];
      const memoryBlocksToAdd: typeof memory_blocks = [];
      const memoryBlocksToUpdate: typeof memory_blocks = [];

      // Process all unique labels
      for (const label of allLabels) {
        const existingBlock = existingBlockMap.get(label);
        const newBlock = newBlockMap.get(label);

        if (existingBlock && newBlock) {
          // Block exists in both - it's an update
          memoryBlocksToUpdate.push(newBlock);
        } else if (newBlock) {
          // Block only exists in new template - it's an add
          memoryBlocksToAdd.push(newBlock);
        } else if (existingBlock) {
          // Block only exists in existing agent - it's a delete
          memoryBlocksToDelete.push(existingBlock);
        }
      }

      await Promise.all([
        ...memoryBlocksToDelete.map(async (block) => {
          return BlocksService.deleteBlock(
            {
              blockId: block.id || '',
            },
            {
              user_id: lettaAgentsUserId,
            },
          ).catch((res) => {
            if (isAPIError(res)) {
              console.error(
                'API Error deleting agent from template:',
                res.status,
              );
              console.error(
                'API Error deleting agent from template:',
                res.body,
              );
            }
            throw res;
          });
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
          ).catch((res) => {
            if (isAPIError(res)) {
              console.error(
                'API Error creating block from template:',
                res.status,
              );
              console.error(
                'API Error creating block from template:',
                res.body,
              );
            }
            throw res;
          });

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
          ).catch((res) => {
            if (isAPIError(res)) {
              console.error(
                'API Error attaching block from template:',
                res.status,
              );
              console.error(
                'API Error attaching block from template:',
                res.body,
              );
            }
            throw res;
          });
        }),
        ...memoryBlocksToUpdate.map(async (block) => {
          if (!block.label) {
            return;
          }

          if (block.preserve_on_migration) {
            return AgentsService.modifyCoreMemoryBlock(
              {
                agentId: agentToUpdateId,
                blockLabel: block.label,
                requestBody: {
                  preserve_on_migration: block.preserve_on_migration || false,
                },
              },
              {
                user_id: lettaAgentsUserId,
              },
            ).catch((res) => {
              if (isAPIError(res)) {
                console.error(
                  'API Error modifying block from template:',
                  res.status,
                );
                console.error(
                  'API Error modifying block from template:',
                  res.body,
                );
              }
              throw res;
            });
          }

          return AgentsService.modifyCoreMemoryBlock(
            {
              agentId: agentToUpdateId,
              blockLabel: block.label,
              requestBody: {
                value: block.value,
                limit: block.limit,
                preserve_on_migration: block.preserve_on_migration || false,
                description: block.description || '',
                read_only: block.read_only || false,
              },
            },
            {
              user_id: lettaAgentsUserId,
            },
          ).catch((res) => {
            if (isAPIError(res)) {
              console.error(
                'API Error modifying block from template:',
                res.status,
              );
              console.error(
                'API Error modifying block from template:',
                res.body,
              );
            }
            throw res;
          });
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
  ).catch((res) => {
    if (isAPIError(res)) {
      console.error('API Error updating agent from template:', res.status);
      console.error('API Error updating agent from template:', res.body);
    }
    throw res;
  });

  return agent;
}
