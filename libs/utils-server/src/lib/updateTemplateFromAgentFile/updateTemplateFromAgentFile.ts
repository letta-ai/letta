import { db, lettaTemplates, blockTemplate, agentTemplateV2, agentTemplateBlockTemplates } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import type { AgentFileSchema } from '@letta-cloud/sdk-core';
import { nanoid } from 'nanoid';
import { DEFAULT_LLM_MODEL } from '@letta-cloud/types';
import { convertRecordMemoryVariablesToMemoryVariablesV1 } from '@letta-cloud/utils-shared';
import { mapToolsFromAgentFile, mapAgentToolIds } from '../mapToolsFromAgentFile/mapToolsFromAgentFile';
import {
  determineTemplateType,
  setGroupConfiguration
} from '../createTemplate/createTemplate';

export const UPDATE_TEMPLATE_FROM_AGENT_FILE_ERRORS = {
  TEMPLATE_NOT_FOUND: 'Template not found',
  NOT_CURRENT_VERSION: 'Only the :current version can be updated from agent file',
  INVALID_AGENT_FILE: 'Invalid agent file format',
  AGENT_IS_MANAGER_DELETE_FORBIDDEN: 'Cannot delete agent that is a manager of the group',
  TOOL_CREATION_FAILED: 'Failed to create one or more custom tools',
  TOOL_UPDATE_FAILED: 'Failed to update one or more existing custom tools',
  TOOL_UPDATE_FAILED_NO_SOURCE_CHANGE: 'Cannot change source_type of existing tool',
  TOOLS_MISSING_JSON_CONFIG: 'One or more custom tools provided are missing json_schema configuration',
  TEMPLATE_TYPE_CHANGE_FORBIDDEN: 'Cannot change template type when updating from agent file',
};

interface UpdateTemplateFromAgentFileOptions {
  projectId: string;
  templateName: string;
  organizationId: string;
  lettaAgentsId: string;
  agentFile: AgentFileSchema;
  updateExistingTools?: boolean;
}

export async function updateTemplateFromAgentFile(
  options: UpdateTemplateFromAgentFileOptions,
): Promise<{ success: boolean; message?: string }> {
  const { projectId, templateName, organizationId, lettaAgentsId, agentFile, updateExistingTools = false } = options;

  // Validate agent file structure
  if (!agentFile || !agentFile.agents) {
    throw new Error(UPDATE_TEMPLATE_FROM_AGENT_FILE_ERRORS.INVALID_AGENT_FILE);
  }

  // Find the current template
  const currentTemplate = await db.query.lettaTemplates.findFirst({
    where: and(
      eq(lettaTemplates.name, templateName),
      eq(lettaTemplates.projectId, projectId),
      eq(lettaTemplates.organizationId, organizationId),
      eq(lettaTemplates.version, 'current'),
    ),
  });

  if (!currentTemplate) {
    throw new Error(UPDATE_TEMPLATE_FROM_AGENT_FILE_ERRORS.TEMPLATE_NOT_FOUND);
  }

  // Determine the new template type from agent file
  let newTemplateType = determineTemplateType(agentFile);

  // Check if template type would change and prevent it
  if (currentTemplate.type !== newTemplateType) {
    if (newTemplateType === 'classic' && currentTemplate.type === 'cluster' ) {
      // this is allowed, basically happens when a user removes all but 1 agent from a cluster template
      // we should keep it a cluster, instead of auto-classic it :)
      newTemplateType = 'cluster'
    } else {
      throw new Error(UPDATE_TEMPLATE_FROM_AGENT_FILE_ERRORS.TEMPLATE_TYPE_CHANGE_FORBIDDEN);
    }
  }

  // Validate tools if they exist
  if (agentFile.tools) {
    for (const tool of agentFile.tools) {
      if (tool.tool_type === 'custom' && tool.source_code && !tool.json_schema) {
        throw new Error(UPDATE_TEMPLATE_FROM_AGENT_FILE_ERRORS.TOOLS_MISSING_JSON_CONFIG);
      }
    }
  }

  const templateId = currentTemplate.id;

  await db.transaction(async (tx) => {
    // Create tool mapping from agent file tools to server tool IDs
    let toolMapping: Record<string, string> = {};
    try {
      toolMapping = await mapToolsFromAgentFile({
        base: agentFile,
        lettaAgentsId,
        updateExistingTools,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot change source_type')) {
        throw new Error(UPDATE_TEMPLATE_FROM_AGENT_FILE_ERRORS.TOOL_UPDATE_FAILED_NO_SOURCE_CHANGE);
      }
      throw new Error(UPDATE_TEMPLATE_FROM_AGENT_FILE_ERRORS.TOOL_CREATION_FAILED);
    }

    // Get existing entities to preserve what's possible based on entityId
    const existingBlocks = await tx.query.blockTemplate.findMany({
      where: eq(blockTemplate.lettaTemplateId, templateId),
    });
    const existingAgents = await tx.query.agentTemplateV2.findMany({
      where: eq(agentTemplateV2.lettaTemplateId, templateId),
    });

    // Delete all associations first
    await tx.delete(agentTemplateBlockTemplates).where(eq(agentTemplateBlockTemplates.lettaTemplateId, templateId));

    // Update group configuration if groups are present (without changing template type)
    if (agentFile.groups && agentFile.groups.length > 0) {
      let mainAgentEntityId = nanoid(8);
      if (agentFile.groups[0]?.manager_config && 'manager_agent_id' in agentFile.groups[0].manager_config) {
        mainAgentEntityId = agentFile.groups[0].manager_config.manager_agent_id;
      }

      await tx
        .update(lettaTemplates)
        .set({
          groupConfiguration: setGroupConfiguration(
            currentTemplate.type, // Use existing template type
            agentFile.groups,
            mainAgentEntityId,
          ),
        })
        .where(eq(lettaTemplates.id, templateId));
    }

    // Handle blocks - preserve by entityId (using agent file IDs as entity IDs)
    const agentFileBlockIds = new Set((agentFile.blocks || []).map((b) => b.id));

    // Delete blocks that are no longer in agent file
    const blocksToDelete = existingBlocks.filter(b => !agentFileBlockIds.has(b.entityId));
    if (blocksToDelete.length > 0) {
      for (const block of blocksToDelete) {
        await tx.delete(blockTemplate).where(eq(blockTemplate.id, block.id));
      }
    }

    // Update or insert blocks
    for (const agentFileBlock of agentFile.blocks || []) {
      const existingBlock = existingBlocks.find(b => b.entityId === agentFileBlock.id);

      if (existingBlock) {
        // Update existing block
        await tx
          .update(blockTemplate)
          .set({
            value: agentFileBlock.value,
            limit: agentFileBlock.limit || 8000,
            description: agentFileBlock.description || '',
            preserveOnMigration: agentFileBlock.preserve_on_migration || null,
            readOnly: agentFileBlock.read_only || false,
            label: agentFileBlock.label,
          })
          .where(eq(blockTemplate.id, existingBlock.id));
      } else {
        // Insert new block
        await tx.insert(blockTemplate).values({
          lettaTemplateId: templateId,
          organizationId,
          projectId,
          entityId: agentFileBlock.id,
          value: agentFileBlock.value,
          limit: agentFileBlock.limit || 8000,
          label: agentFileBlock.label,
          description: agentFileBlock.description || '',
          preserveOnMigration: agentFileBlock.preserve_on_migration || null,
          readOnly: agentFileBlock.read_only || false,
        });
      }
    }

    // Handle agents - preserve by entityId (using agent file IDs as entity IDs)
    const agentFileAgentIds = new Set(agentFile.agents.map((a) => a.id));

    // Delete agents that are no longer in agent file
    const agentsToDelete = existingAgents.filter(a => !agentFileAgentIds.has(a.entityId));

    // Check if we're trying to delete the group manager
    const groupManagerEntityId = currentTemplate.groupConfiguration?.managerAgentEntityId;
    if (groupManagerEntityId) {
      const isInAgentsToDelete = agentsToDelete.some(agent => agent.entityId === groupManagerEntityId);
      if (isInAgentsToDelete) {
        throw new Error(UPDATE_TEMPLATE_FROM_AGENT_FILE_ERRORS.AGENT_IS_MANAGER_DELETE_FORBIDDEN);
      }
    }

    if (agentsToDelete.length > 0) {
      for (const agent of agentsToDelete) {
        await tx.delete(agentTemplateV2).where(eq(agentTemplateV2.id, agent.id));
      }
    }

    // Update or insert agents
    for (const agentFileAgent of agentFile.agents) {
      const existingAgent = existingAgents.find(a => a.entityId === agentFileAgent.id);

      // Convert tool environment variables to the format expected by the template
      const toolVariables = agentFileAgent.tool_exec_environment_variables
        ? convertRecordMemoryVariablesToMemoryVariablesV1(agentFileAgent.tool_exec_environment_variables)
        : null;

      // Map tool IDs using the tool mapping
      const mappedToolIds = toolMapping ? mapAgentToolIds(agentFileAgent, toolMapping) : (agentFileAgent.tool_ids ?? []);

      const agentData = {
        toolIds: mappedToolIds,
        sourceIds: [],
        tags: agentFileAgent.tags ?? [],
        identityIds: [],
        agentType: agentFileAgent.agent_type ?? 'memgpt_v2_agent',
        model: agentFileAgent.llm_config?.handle ?? DEFAULT_LLM_MODEL,
        toolRules: agentFileAgent.tool_rules ?? [],
        systemPrompt: agentFileAgent.system ?? '',
        toolVariables,
        memoryVariables: null,
        properties: {
          verbosity_level: agentFileAgent.llm_config?.verbosity ?? null,
          reasoning_effort: agentFileAgent.llm_config?.reasoning_effort ?? null,
          temperature: agentFileAgent.llm_config?.temperature ?? 0.7,
          enable_reasoner: agentFileAgent.llm_config?.enable_reasoner ?? false,
          put_inner_thoughts_in_kwargs: agentFileAgent.llm_config?.put_inner_thoughts_in_kwargs ?? false,
          context_window_limit: agentFileAgent.llm_config?.context_window ?? null,
          max_tokens: agentFileAgent.llm_config?.max_tokens ?? null,
          max_reasoning_tokens: agentFileAgent.llm_config?.max_reasoning_tokens ?? null,
          max_files_open: null,
          per_file_view_window_char_limit: null,
          message_buffer_autoclear: null,
        },
      };

      if (existingAgent) {
        // Update existing agent
        await tx
          .update(agentTemplateV2)
          .set(agentData)
          .where(eq(agentTemplateV2.id, existingAgent.id));
      } else {
        // Insert new agent
        await tx.insert(agentTemplateV2).values({
          ...agentData,
          lettaTemplateId: templateId,
          organizationId,
          projectId,
          entityId: agentFileAgent.id,
        });
      }
    }

    // Create agent-block associations based on agent file relationships
    // Get all current entities after updates
    const currentAgents = await tx.query.agentTemplateV2.findMany({
      where: eq(agentTemplateV2.lettaTemplateId, templateId),
    });
    const currentBlocks = await tx.query.blockTemplate.findMany({
      where: eq(blockTemplate.lettaTemplateId, templateId),
    });

    // Create maps for entity ID to record ID
    const agentEntityIdToId = new Map(currentAgents.map(a => [a.entityId, a.id]));
    const blockEntityIdToId = new Map(currentBlocks.map(b => [b.entityId, b.id]));

    // Create associations based on agent file block_ids
    const associationsToCreate: Array<{
      lettaTemplateId: string;
      agentTemplateSchemaId: string;
      blockTemplateId: string;
      blockLabel: string;
    }> = [];

    for (const agent of agentFile.agents) {
      if (agent.block_ids && agent.block_ids.length > 0) {
        const agentId = agentEntityIdToId.get(agent.id);

        if (agentId) {
          for (const blockId of agent.block_ids) {
            const blockTemplateId = blockEntityIdToId.get(blockId);
            const block = currentBlocks.find(b => b.entityId === blockId);

            if (blockTemplateId && block) {
              associationsToCreate.push({
                lettaTemplateId: templateId,
                agentTemplateSchemaId: agentId,
                blockTemplateId,
                blockLabel: block.label,
              });
            }
          }
        }
      }
    }

    if (associationsToCreate.length > 0) {
      await tx.insert(agentTemplateBlockTemplates).values(associationsToCreate)
        .onConflictDoNothing(); // Avoid duplicates
    }
  });

  return {
    success: true,
    message: 'Current template updated from agent file successfully',
  };
}
