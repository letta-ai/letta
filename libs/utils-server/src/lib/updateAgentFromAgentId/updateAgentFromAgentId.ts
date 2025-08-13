import { AgentsService, BlocksService } from '@letta-cloud/sdk-core';
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
    requestBody.tool_exec_environment_variables = agentTemplateData.tool_exec_environment_variables?.reduce(
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
            );
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
