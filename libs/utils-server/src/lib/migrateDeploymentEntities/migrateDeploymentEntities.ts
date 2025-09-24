import {
  AgentsService,
  BlocksService,
  GroupsService,
  InternalTemplatesService,
} from '@letta-cloud/sdk-core';
import type { UpdateAgent, DeploymentEntity } from '@letta-cloud/sdk-core';
import { createCachedLLMConfigRetriever } from '../getCachedLLMConfig/getCachedLLMConfig';

import {
  db,
  agentTemplateV2,
  agentTemplateBlockTemplates,
  blockTemplate,
  lettaTemplates,
  deployedAgentVariables,
  deployedAgentMetadata,
  deployment,
} from '@letta-cloud/service-database';
import { eq, inArray } from 'drizzle-orm';
import {
  attachMemoryVariablesToBlockValue,
  convertMemoryVariablesV1ToRecordMemoryVariables,
} from '@letta-cloud/utils-shared';
import { DEFAULT_EMBEDDING_CONFIG } from '@letta-cloud/types';
import { adjectives, animals, colors, uniqueNamesGenerator } from 'unique-names-generator';

interface MigrateDeploymentEntitiesOptions {
  preserveCoreMemories?: boolean;
  preserveToolVariables?: boolean;
  memoryVariables: Record<string, string>;
  deploymentId: string;
  templateId: string;
  lettaAgentsUserId: string;
  organizationId: string;
  baseTemplateId?: string;
}

export async function migrateDeploymentEntities(
  options: MigrateDeploymentEntitiesOptions,
) {
  const {
    preserveCoreMemories = false,
    preserveToolVariables = false,
    memoryVariables,
    deploymentId,
    templateId,
    lettaAgentsUserId,
    organizationId,
    baseTemplateId,
  } = options;

  // Get the new template schema and existing deployment data
  const [newTemplate, existingDeploymentEntities] = await Promise.all([
    db.query.lettaTemplates.findFirst({
      where: eq(lettaTemplates.id, templateId),
    }),
    InternalTemplatesService.listDeploymentEntities(
      {
        deploymentId,
      },
      {
        user_id: lettaAgentsUserId,
      },
    ),
  ]);


  if (!newTemplate) {
    throw new Error('New template not found');
  }

  if (!existingDeploymentEntities.entities) {
    throw new Error('Deployment entities not found');
  }

  // Mark deployment as in progress
  await db
    .update(deployment)
    .set({
      status: 'migrating',
    })
    .where(eq(deployment.id, deploymentId));

  try {
    // Separate entities by type
    const existingBlocks = existingDeploymentEntities.entities.filter(
      (entity: DeploymentEntity) => entity.type === 'block',
    );
    const existingAgents = existingDeploymentEntities.entities.filter(
      (entity: DeploymentEntity) => entity.type === 'agent',
    );
    const existingGroup = existingDeploymentEntities.entities.find(
      (entity: DeploymentEntity) => entity.type === 'group',
    );

    // Preload all deployed agent variables for existing agents
    const existingAgentIds = existingAgents.map((agent) => agent.id);
    const agentVariablesMap = new Map<string, Record<string, string>>();

    if (existingAgentIds.length > 0) {
      const agentVariables = await db.query.deployedAgentVariables.findMany({
        where: inArray(
          deployedAgentVariables.deployedAgentId,
          existingAgentIds,
        ),
      });

      agentVariables.forEach((vars) => {
        if (vars.value) {
          agentVariablesMap.set(vars.deployedAgentId, vars.value);
        }
      });
    }

    // Get agent templates, block templates, and block associations for the new template
    const [newAgentTemplates, newBlockTemplates, newAgentBlockAssociations] =
      await Promise.all([
        db.query.agentTemplateV2.findMany({
          where: eq(agentTemplateV2.lettaTemplateId, templateId),
        }),
        db.query.blockTemplate.findMany({
          where: eq(blockTemplate.lettaTemplateId, templateId),
        }),
        db.query.agentTemplateBlockTemplates.findMany({
          where: eq(agentTemplateBlockTemplates.lettaTemplateId, templateId),
          with: {
            blockTemplate: {
              columns: {
                entityId: true,
              },
            },
            agentTemplate: {
              columns: {
                entityId: true,
              },
            },
          },
        }),
      ]);

    // Step 1: Update blocks first (reverse order requirement)

      // Create a map of new block templates by entity ID
      const newBlockTemplateMap = new Map(
        newBlockTemplates.map((block) => [block.entityId, block]),
      );

      const existingBlockMap = new Map(
        existingBlocks.map((block) => [block.entity_id || '', block]),
      );

      // Find blocks to delete, add, and update
      const blocksToDelete = existingBlocks.filter(
        (block) => !newBlockTemplateMap.has(block.entity_id || ''),
      );
      const blocksToAdd = newBlockTemplates.filter(
        (template) => !existingBlockMap.has(template.entityId),
      );
      const blocksToUpdate = newBlockTemplates.filter((template) =>
        existingBlockMap.has(template.entityId),
      );

      // Delete blocks that are no longer in the template
      await Promise.all(
        blocksToDelete.map(async (block) => {
          if (block.id) {
            return BlocksService.deleteBlock(
              {
                blockId: block.id,
              },
              {
                user_id: lettaAgentsUserId,
              },
            );
          }
        }),
      );

      // Add new blocks from the template
      const newBlockIdMap = new Map<string, string>();

      await Promise.all(
        blocksToAdd.map(async (blockTemplate) => {
          let processedValue = blockTemplate.value;
          // For new blocks, just use the provided memory variables since there's no existing agent context
          if (memoryVariables && typeof blockTemplate.value === 'string') {
            processedValue = attachMemoryVariablesToBlockValue(
              blockTemplate.value,
              memoryVariables,
            );
          }

          const createdBlock =
            await InternalTemplatesService.createInternalTemplateBlock(
              {
                requestBody: {
                  value: processedValue,
                  limit: blockTemplate.limit,
                  label: blockTemplate.label,
                  entity_id: blockTemplate.entityId,
                  deployment_id: deploymentId,
                  base_template_id: baseTemplateId || '',
                  template_id: templateId,
                  description: blockTemplate.description,
                  preserve_on_migration:
                    blockTemplate.preserveOnMigration || false,
                  read_only: blockTemplate.readOnly || false,
                  project_id: newTemplate.projectId,
                },
              },
              {
                user_id: lettaAgentsUserId,
              },
            );

          if (createdBlock.id) {
            newBlockIdMap.set(blockTemplate.entityId, createdBlock.id);
          }
        }),
      );

      // Update existing blocks with new values from template
      await Promise.all(
        blocksToUpdate.map(async (blockTemplate) => {
          const existingBlock = existingBlockMap.get(blockTemplate.entityId);
          if (!existingBlock?.id) return;

          // Find the agents that own this specific block
          const agentsForBlock = await BlocksService.listAgentsForBlock(
            {
              blockId: existingBlock.id,
            },
            {
              user_id: lettaAgentsUserId,
            },
          );

          for (const agent of agentsForBlock || []) {
            // Get the block details to find its label
            const blockDetails = await BlocksService.retrieveBlock(
              {
                blockId: existingBlock.id,
              },
              {
                user_id: lettaAgentsUserId,
              },
            );

            if (blockDetails?.label) {
              // Get agent-specific memory variables and merge with provided ones
              const agentVariables =
                agentVariablesMap.get(agent.id || '') || {};
              const finalMemoryVariables = {
                ...agentVariables,
                ...memoryVariables,
              };

              let processedValue = blockTemplate.value;
              if (
                finalMemoryVariables &&
                typeof blockTemplate.value === 'string'
              ) {
                processedValue = attachMemoryVariablesToBlockValue(
                  blockTemplate.value,
                  finalMemoryVariables,
                );
              }


              // Update the core memory block through the agent
              await AgentsService.modifyCoreMemoryBlock(
                {
                  agentId: agent.id || '',
                  blockLabel: blockDetails.label,
                  requestBody: {
                    ...!preserveCoreMemories && { value: processedValue },
                    limit: blockTemplate.limit,
                    preserve_on_migration:
                      blockTemplate.preserveOnMigration || false,
                    description: blockTemplate.description || '',
                    read_only: blockTemplate.readOnly || false,
                  },
                },
                {
                  user_id: lettaAgentsUserId,
                },
              );
            }
          }
        }),
      );


    // Step 2: Update agents
    const newAgentTemplateMap = new Map(
      newAgentTemplates.map((agent) => [agent.entityId, agent]),
    );
    const existingAgentMap = new Map(
      existingAgents.map((agent) => [agent.entity_id || '', agent]),
    );

    // Find agents to delete, add, and update
    const agentsToDelete = existingAgents.filter(
      (agent) => !newAgentTemplateMap.has(agent.entity_id || ''),
    );


    const agentsToAdd = newAgentTemplates.filter(
      (template) => !existingAgentMap.has(template.entityId),
    );
    const agentsToUpdate = newAgentTemplates.filter((template) =>
      existingAgentMap.has(template.entityId),
    );

    // Delete agents that are no longer in the template
    await Promise.all(
      agentsToDelete.map(async (agent) => {
        if (agent.id) {
          return AgentsService.deleteAgent(
            {
              agentId: agent.id,
            },
            {
              user_id: lettaAgentsUserId,
            },
          );
        }
      }),
    );

    // Get updated deployment entities to get current block IDs
    const updatedDeploymentEntities =
      await InternalTemplatesService.listDeploymentEntities(
        {
          deploymentId,
        },
        {
          user_id: lettaAgentsUserId,
        },
      );

    const currentBlocks =
      updatedDeploymentEntities.entities?.filter(
        (entity: DeploymentEntity) => entity.type === 'block',
      ) || [];



    const currentBlockMap = new Map(
      currentBlocks.map((block) => [block.entity_id || '', block.id]),
    );

    // Add new agents from the template
    const newAgentIdMap = new Map<string, string>();
    const llmRetriever = createCachedLLMConfigRetriever(lettaAgentsUserId);

    await Promise.all(
      agentsToAdd.map(async (agentTemplate) => {
        // Get initial tool variables from the template
        const initialToolVariables = agentTemplate.toolVariables
          ? convertMemoryVariablesV1ToRecordMemoryVariables(
              agentTemplate.toolVariables,
            )
          : {};
        const finalToolVariables = {
          ...initialToolVariables,
          // Could add tool variable overrides here if needed
        };

        // Get LLM config using cached retriever
        let llmConfig = await llmRetriever.getCachedLLMConfig(
          agentTemplate.model,
        );

        if (process.env.NODE_ENV !== 'production' && !llmConfig) {
          const allModels = await llmRetriever.getAllCachedLLMConfigs();
          llmConfig  = allModels[0];
        } else if (!llmConfig) {
          throw new Error(`Model ${agentTemplate.model} not found`);
        }

        // Apply template properties to LLM config
        const finalLlmConfig = {
          ...llmConfig,
          max_tokens:
            agentTemplate.properties?.max_tokens || llmConfig.max_tokens,
          temperature:
            agentTemplate.properties?.temperature || llmConfig.temperature,
          context_window:
            agentTemplate.properties?.context_window_limit ||
            llmConfig.context_window,
          max_reasoning_tokens:
            agentTemplate.properties?.max_reasoning_tokens ||
            llmConfig.max_reasoning_tokens,
          verbosity:
            agentTemplate.properties?.verbosity_level || llmConfig.verbosity,
          reasoning_effort:
            agentTemplate.properties?.reasoning_effort ||
            llmConfig.reasoning_effort,
          enable_reasoner:
            agentTemplate.properties?.enable_reasoner ?? undefined,
          put_inner_thoughts_in_kwargs:
            agentTemplate.properties?.put_inner_thoughts_in_kwargs ?? undefined,
        };

        // Get block IDs for this agent
        const blockIds =
          newAgentBlockAssociations
            ?.map((association) => {
              const blockEntityId = association.blockTemplate.entityId;
              const agentTemplateEntityId = association.agentTemplate.entityId;

              if (agentTemplateEntityId === agentTemplate.entityId) {
                return currentBlockMap.get(blockEntityId);
              }
            })
            .filter((id): id is string => !!id) || [];

        const createdAgent =
          await InternalTemplatesService.createInternalTemplateAgent(
            {
              requestBody: {
                project_id: newTemplate.projectId,
                name: uniqueNamesGenerator({
                  dictionaries: [adjectives, colors, animals],
                  length: 3,
                  separator: '-',
                }),
                deployment_id: deploymentId,
                entity_id: agentTemplate.entityId,
                system: agentTemplate.systemPrompt,
                llm_config: finalLlmConfig,
                tool_ids: agentTemplate.toolIds || [],
                block_ids: blockIds,
                tool_rules: agentTemplate.toolRules || [],
                source_ids: agentTemplate.sourceIds || [],
                tags: agentTemplate.tags,
                identity_ids: agentTemplate.identityIds,
                tool_exec_environment_variables: finalToolVariables,
                hidden: false,
                include_base_tools: false,
                include_base_tool_rules: false,
                include_multi_agent_tools: false,
                include_default_source: false,
                max_files_open: agentTemplate.properties?.max_files_open,
                reasoning:
                  agentTemplate.properties?.enable_reasoner ||
                  agentTemplate.properties?.put_inner_thoughts_in_kwargs,
                per_file_view_window_char_limit:
                  agentTemplate.properties?.per_file_view_window_char_limit,
                template_id: templateId,
                base_template_id: baseTemplateId || '',
                embedding_config: DEFAULT_EMBEDDING_CONFIG,
              },
            },
            {
              user_id: lettaAgentsUserId,
            },
          );

        if (createdAgent.id) {
          newAgentIdMap.set(agentTemplate.entityId, createdAgent.id);
        }
      }),
    );

    // Insert deployed agent metadata and variables for newly created agents
    if (agentsToAdd.length > 0) {
      await db.transaction(async (tx) => {
        await Promise.all(
          agentsToAdd.map(async (agentTemplate) => {
            const agentId = newAgentIdMap.get(agentTemplate.entityId);
            if (!agentId) {
              throw new Error('Failed to create agent from template');
            }

            // Insert deployed agent metadata
            await tx.insert(deployedAgentMetadata).values({
              deploymentId: deploymentId,
              agentId: agentId,
              projectId: newTemplate.projectId,
              organizationId: organizationId,
            });

            // Insert deployed agent variables (merge existing template variables with provided ones)
            const finalVariables = {
              ...memoryVariables,
            };

            await tx.insert(deployedAgentVariables).values({
              deployedAgentId: agentId,
              deploymentId: deploymentId,
              value: finalVariables,
              organizationId: organizationId,
            });
          }),
        );
      });
    }


    // Update existing agents with new values from template
    await Promise.all(
      agentsToUpdate.map(async (agentTemplate) => {
        const existingAgent = existingAgentMap.get(agentTemplate.entityId);
        if (!existingAgent?.id) return;

        // Get the agent details first
        const agentDetails = await AgentsService.retrieveAgent(
          {
            agentId: existingAgent.id,
          },
          {
            user_id: lettaAgentsUserId,
          },
        );



        let requestBody: UpdateAgent = {};

        // attach new block IDs
        const blockIds =
          newAgentBlockAssociations
            ?.map((association) => {
              const blockEntityId = association.blockTemplate.entityId;
              const agentTemplateEntityId = association.agentTemplate.entityId;

              if (agentTemplateEntityId === agentTemplate.entityId) {
                return currentBlockMap.get(blockEntityId);
              }
            })
            .filter((id): id is string => !!id) || [];



        if (blockIds.length > 0) {
          requestBody.block_ids = blockIds;
        }

        // Update tool IDs
        if (agentTemplate.toolIds) {
          requestBody.tool_ids = agentTemplate.toolIds;
        }

        // Update tool rules
        if (agentTemplate.toolRules) {
          requestBody.tool_rules = agentTemplate.toolRules;
        }

        // Update file-related properties
        if (agentTemplate.properties?.max_files_open) {
          requestBody.max_files_open = agentTemplate.properties.max_files_open;
        }

        if (agentTemplate.properties?.per_file_view_window_char_limit) {
          requestBody.per_file_view_window_char_limit =
            agentTemplate.properties.per_file_view_window_char_limit;
        }

        // Apply tool variables if provided
        if (preserveToolVariables) {
          if (agentTemplate.toolVariables) {
            // existing agent tool map
            const existingToolMap: Record<string, string> = {};
            agentDetails.tool_exec_environment_variables?.forEach((tool) => {
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

        // Apply template ID
        requestBody = {
          ...requestBody,
          template_id: templateId,
        };

        // Apply source IDs from template schema
        if (agentTemplate.sourceIds) {
          requestBody = {
            ...requestBody,
            source_ids: agentTemplate.sourceIds,
          };
        }

        // Update LLM config
        let nextLLMConfig = agentDetails.llm_config;

        if (agentTemplate.model !== nextLLMConfig.model) {
          const model = await llmRetriever.getCachedLLMConfig(
            agentTemplate.model,
          );

          if (!model) {
            throw new Error(`Model ${agentTemplate.model} not found`);
          }

          nextLLMConfig = {
            ...nextLLMConfig,
            ...model,
          };
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

        if (
          agentTemplate.properties?.enable_reasoner !== null &&
          agentTemplate.properties?.enable_reasoner !== undefined
        ) {
          nextLLMConfig.enable_reasoner =
            agentTemplate.properties.enable_reasoner;
        }

        if (
          agentTemplate.properties?.put_inner_thoughts_in_kwargs !== null &&
          agentTemplate.properties?.put_inner_thoughts_in_kwargs !== undefined
        ) {
          nextLLMConfig.put_inner_thoughts_in_kwargs =
            agentTemplate.properties.put_inner_thoughts_in_kwargs;
        }

        if (agentTemplate.properties?.temperature) {
          nextLLMConfig.temperature = agentTemplate.properties.temperature;
        }

        if (agentTemplate.properties?.verbosity_level) {
          nextLLMConfig.verbosity = agentTemplate.properties.verbosity_level;
        }

        if (agentTemplate.properties?.reasoning_effort) {
          nextLLMConfig.reasoning_effort =
            agentTemplate.properties.reasoning_effort;
        }

        requestBody.llm_config = nextLLMConfig;
        requestBody.reasoning =
          nextLLMConfig.enable_reasoner ||
          nextLLMConfig.put_inner_thoughts_in_kwargs;

        return AgentsService.modifyAgent(
          {
            agentId: existingAgent.id,
            requestBody,
          },
          {
            user_id: lettaAgentsUserId,
          },
        );
      }),
    );


    // Step 3: Update group (if exists)
    if (existingGroup) {
      // fetch group by id
      const foundGroup = await GroupsService.retrieveGroup(
        {
          groupId: existingGroup.id || '',
        },
        {
          user_id: lettaAgentsUserId,
        },
      );


      // Get current deployment entities to get updated agent IDs
      const finalDeploymentEntities =
        await InternalTemplatesService.listDeploymentEntities(
          {
            deploymentId,
          },
          {
            user_id: lettaAgentsUserId,
          },
        );

      const currentAgents =
        finalDeploymentEntities.entities?.filter(
          (entity: DeploymentEntity) => entity.type === 'agent',
        ) || [];
      const currentAgentIds = currentAgents
        .map((agent) => agent.id)
        .filter(Boolean);


      // Check that the group type hasn't changed
      if (newTemplate.type !== foundGroup.manager_type) {
        throw new Error('Group type cannot be changed during migration');
      }

      // Build manager config based on template
      let managerConfig: Record<string, unknown> = {
        manager_type: newTemplate.type,
      };

      if (newTemplate.groupConfiguration) {
        const managerAgentId = newTemplate.groupConfiguration
          .managerAgentEntityId
          ? currentAgents.find(
              (agent) =>
                agent.entity_id ===
                newTemplate.groupConfiguration?.managerAgentEntityId,
            )?.id
          : null;

        switch (newTemplate.type) {
          case 'dynamic':
            if (!managerAgentId) {
              throw new Error('Dynamic groups require a manager agent');
            }
            managerConfig = {
              manager_type: 'dynamic',
              manager_agent_id: managerAgentId,
              termination_token:
                newTemplate.groupConfiguration.terminationToken || 'stop',
              max_turns: newTemplate.groupConfiguration.maxTurns || 15,
            };
            break;
          case 'supervisor':
            if (!managerAgentId) {
              throw new Error('Supervisor groups require a manager agent');
            }
            managerConfig = {
              manager_type: 'supervisor',
              manager_agent_id: managerAgentId,
            };
            break;
          case 'round_robin':
            managerConfig = {
              manager_type: 'round_robin',
              max_turns: newTemplate.groupConfiguration.maxTurns || 15,
            };
            break;
          case 'voice_sleeptime':
            if (!managerAgentId) {
              throw new Error('Voice sleeptime groups require a manager agent');
            }
            managerConfig = {
              manager_type: 'voice_sleeptime',
              manager_agent_id: managerAgentId,
              max_message_buffer_length:
                newTemplate.groupConfiguration.maxMessageBufferLength || 15,
              min_message_buffer_length:
                newTemplate.groupConfiguration.minMessageBufferLength || 15,
            };
            break;
          case 'sleeptime':
            if (!managerAgentId) {
              throw new Error('Sleeptime groups require a manager agent');
            }
            managerConfig = {
              manager_type: 'sleeptime',
              manager_agent_id: managerAgentId,
              sleeptime_agent_frequency:
                newTemplate.groupConfiguration.sleeptimeAgentFrequency || 15,
            };
            break;
        }
      }

      await GroupsService.modifyGroup(
        {
          groupId: existingGroup.id,
          requestBody: {
            manager_config: managerConfig,
            agent_ids: currentAgentIds,
          },
        },
        {
          user_id: lettaAgentsUserId,
        },
      );
    }

    // Mark deployment as successful
    await db
      .update(deployment)
      .set({
        lettaTemplateId: templateId,
        status: 'ready',
      })
      .where(eq(deployment.id, deploymentId));

    // Return the final state
    return await InternalTemplatesService.listDeploymentEntities(
      {
        deploymentId,
      },
      {
        user_id: lettaAgentsUserId,
      },
    );
  } catch (error) {
    // Mark deployment as failed
    await db
      .update(deployment)
      .set({
        status: 'failed',
        statusMessage:
          error instanceof Error
            ? error.message
            : 'Migration failed with unknown error',
      })
      .where(eq(deployment.id, deploymentId));

    throw error;
  }
}
