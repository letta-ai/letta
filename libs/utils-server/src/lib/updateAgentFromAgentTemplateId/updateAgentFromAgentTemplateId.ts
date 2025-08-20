import { AgentsService, BlocksService, LlmsService } from '@letta-cloud/sdk-core';
import type { UpdateAgent } from '@letta-cloud/sdk-core';

import {
  db,
  agentTemplateV2,
  agentTemplateBlockTemplates,
  blockTemplate,
} from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import {
  attachMemoryVariablesToBlockValue,
  convertMemoryVariablesV1ToRecordMemoryVariables,
} from '@letta-cloud/utils-shared';

interface UpdateAgentFromTemplateOptions {
  preserveCoreMemories?: boolean;
  preserveToolVariables?: boolean;
  memoryVariables: Record<string, string>;
  agentTemplateId: string;
  agentToUpdateId: string;
  lettaAgentsUserId: string;
  organizationId: string;
  baseTemplateId?: string;
  templateId?: string;
}

export async function updateAgentFromAgentTemplateId(
  options: UpdateAgentFromTemplateOptions,
) {
  const {
    preserveCoreMemories = false,
    preserveToolVariables = false,
    memoryVariables,
    agentTemplateId,
    agentToUpdateId,
    lettaAgentsUserId,
    organizationId,
    baseTemplateId,
    templateId,
  } = options;

  // Get the template schema
  const agentTemplate = await db.query.agentTemplateV2.findFirst({
    where: and(
      eq(agentTemplateV2.organizationId, organizationId),
      eq(agentTemplateV2.id, agentTemplateId),
    ),
  });

  if (!agentTemplate) {
    throw new Error('Template schema not found');
  }

  // Get the existing agent to update
  const existingAgent = await AgentsService.retrieveAgent(
    {
      agentId: agentToUpdateId,
    },
    {
      user_id: lettaAgentsUserId,
    },
  );

  // Build the base request body from template schema
  let requestBody: UpdateAgent = {};

  if (agentTemplate.toolIds) {
    requestBody.tool_ids = agentTemplate.toolIds;
  }

  if (agentTemplate.toolRules) {
    requestBody.tool_rules = agentTemplate.toolRules;
  }

  if (agentTemplate.properties?.max_files_open) {
    requestBody.max_files_open = agentTemplate.properties.max_files_open;
  }

  if (agentTemplate.properties?.per_file_view_window_char_limit) {
    requestBody.per_file_view_window_char_limit =
      agentTemplate.properties.per_file_view_window_char_limit;
  }

  if (!preserveCoreMemories) {
    // Get block templates associated with this schema
    const blockTemplates = await db
      .select({
        id: blockTemplate.id,
        label: blockTemplate.label,
        value: blockTemplate.value,
        limit: blockTemplate.limit,
        description: blockTemplate.description,
        preserveOnMigration: blockTemplate.preserveOnMigration,
        readOnly: blockTemplate.readOnly,
      })
      .from(agentTemplateBlockTemplates)
      .innerJoin(
        blockTemplate,
        eq(agentTemplateBlockTemplates.blockTemplateId, blockTemplate.id),
      )
      .where(
        and(
          eq(
            agentTemplateBlockTemplates.agentTemplateSchemaId,
            agentTemplate.id,
          ),
          eq(blockTemplate.organizationId, organizationId),
        ),
      );

    // Process memory blocks with variables
    const memoryBlocks = blockTemplates.map((block) => {
      let processedValue = block.value;

      if (memoryVariables && typeof block.value === 'string') {
        processedValue = attachMemoryVariablesToBlockValue(
          block.value,
          memoryVariables,
        );
      }


      return {
        id: block.id,
        label: block.label,
        value: processedValue,
        limit: block.limit,
        description: block.description,
        preserve_on_migration: block.preserveOnMigration,
        read_only: block.readOnly,
      };
    });

    if (memoryBlocks.length > 0) {
      const existingMemoryBlocks = existingAgent.memory.blocks;

      // Find blocks to delete (exist in agent but not in template)
      const memoryBlocksToDelete = existingMemoryBlocks.filter((block) => {
        return !memoryBlocks.some((newBlock) => newBlock.label === block.label);
      });

      // Find blocks to add (exist in template but not in agent)
      const memoryBlocksToAdd = memoryBlocks.filter((block) => {
        return !existingMemoryBlocks.some(
          (existingBlock) => existingBlock.label === block.label,
        );
      });

      // Find blocks to update (exist in both)
      const memoryBlocksToUpdate = memoryBlocks.filter((block) => {
        return existingMemoryBlocks.some(
          (existingBlock) => existingBlock.label === block.label,
        );
      });

      await Promise.all([
        // Delete blocks that are no longer in the template
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
        // Add new blocks from the template
        ...memoryBlocksToAdd.map(async (block) => {
          if (!block.label) {
            return;
          }

          const createdBlock = await BlocksService.createBlock(
            {
              requestBody: {
                label: block.label,
                description: block.description || '',
                preserve_on_migration: block.preserve_on_migration || false,
                read_only: block.read_only || false,
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
        // Update existing blocks with new values from template
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
                  read_only: block.read_only || false,
                  description: block.description || '',
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

  // Apply tool variables if provided
  if (preserveToolVariables) {
    if (agentTemplate.toolVariables) {
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
        agentTemplate.toolVariables.data.reduce(
          (acc, { key, defaultValue }) => {
            if (typeof key === 'string') {
              // if existing agent has the tool variable, keep it
              if (existingToolMap[key] !== undefined) {
                acc[key] = existingToolMap[key];
              } else {
                // otherwise, use the template's tool variable
                acc[key] = defaultValue || '';
              }
            }

            return acc;
          },
          {} as Record<string, string>,
        );
    }
  } else {
    requestBody = {
      ...requestBody,
      tool_exec_environment_variables: agentTemplate.toolVariables
        ? convertMemoryVariablesV1ToRecordMemoryVariables(
            agentTemplate.toolVariables,
          )
        : {},
    };
  }

  // Apply base template ID if provided
  if (baseTemplateId) {
    requestBody = {
      ...requestBody,
      base_template_id: baseTemplateId,
    };
  }

  // Apply template ID if provided
  if (templateId) {
    requestBody = {
      ...requestBody,
      template_id: templateId,
    };
  }

  // Apply source IDs from template schema
  if (agentTemplate.sourceIds) {
    requestBody = {
      ...requestBody,
      source_ids: agentTemplate.sourceIds,
    };
  }

  let nextLLMConfig = existingAgent.llm_config;


  if (agentTemplate.model) {
    const llms = await LlmsService.listModels({}, {
      user_id: lettaAgentsUserId,
    })

    const model = llms.find(
      (model) => model.handle === agentTemplate.model,
    );

    if (!model) {
      throw new Error(`Model ${agentTemplate.model} not found`);
    }

    nextLLMConfig = {
      ...nextLLMConfig,
      ...model,
    }
  }

  if (agentTemplate.properties?.max_tokens) {
    nextLLMConfig.max_tokens = agentTemplate.properties.max_tokens;
  }

  if (agentTemplate.properties?.max_reasoning_tokens) {
    nextLLMConfig.max_reasoning_tokens =
      agentTemplate.properties.max_reasoning_tokens;
  }

  if (agentTemplate.properties?.context_window_limit) {
    nextLLMConfig.context_window =
      agentTemplate.properties.context_window_limit;
  }


  requestBody.llm_config = nextLLMConfig;


  // Update the agent with the template schema
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
