import type { AgentState, LLMConfig } from '@letta-cloud/sdk-core';
import type {
  agentTemplateV2,
  blockTemplate,
} from '@letta-cloud/service-database';
import { convertRecordMemoryVariablesToMemoryVariablesV1 } from '../convertRecordMemoryVariablesToMemoryVariablesV1/convertRecordMemoryVariablesToMemoryVariablesV1';
import { findMemoryBlockVariables } from '../findMemoryBlockVariables/findMemoryBlockVariables';

type AgentTemplateDBSchema = typeof agentTemplateV2.$inferSelect;
type BlockTemplateDBSchema = typeof blockTemplate.$inferSelect;

export type AgentTemplateStateWithNoMetadata = Omit<
  AgentTemplateDBSchema,
  | 'createdAt'
  | 'entityId'
  | 'id'
  | 'lettaTemplateId'
  | 'name'
  | 'organizationId'
  | 'projectId'
  | 'updatedAt'
>;

export function removeMetadataFromAgentTemplateDatabaseEntity(
  agentTemplate: AgentTemplateDBSchema,
): AgentTemplateStateWithNoMetadata {
  const {
    createdAt,
    entityId,
    id,
    lettaTemplateId,
    name,
    organizationId,
    projectId,
    updatedAt,
    ...rest
  } = agentTemplate;

  return rest;
}

export type BlockTemplateStateWithMetadata = Omit<
  BlockTemplateDBSchema,
  | 'createdAt'
  | 'entityId'
  | 'lettaTemplateId'
  | 'organizationId'
  | 'projectId'
  | 'updatedAt'
>;

export interface SynchronizeSimulatedAgentWithTemplateOutput {
  agentTemplate: AgentTemplateStateWithNoMetadata;
  agentTemplateBlocks: BlockTemplateStateWithMetadata[];
}

export type AgentStateForSynchronization = Omit<
  Partial<AgentState>,
  | 'createdAt'
  | 'deletedAt'
  | 'embedding_config'
  | 'id'
  | 'llm_config'
  | 'name'
  | 'organizationId'
  | 'projectId'
  | 'updatedAt'
> & {
  llm_config: Partial<LLMConfig>;
};

export function synchronizeSimulatedAgentWithAgentTemplate(
  agentState: AgentStateForSynchronization,
): SynchronizeSimulatedAgentWithTemplateOutput {
  if (!agentState.llm_config.handle) {
    throw new Error('Agent state must have a valid llm_config.handle');
  }

  const toolVariablesAsKeyValue =
    agentState.tool_exec_environment_variables?.reduce(
      (acc, variable) => {
        if (variable.key && variable.value) {
          acc[variable.key] = variable.value;
        }
        return acc;
      },
      {} as Record<string, string>,
    );

  // Map memory blocks to BlockTemplateState
  const agentTemplateBlocks: BlockTemplateStateWithMetadata[] =
    agentState.memory?.blocks
      .map((block) => ({
        id: block.id || '',
        value: block.value,
        label: block.label || '',
        limit: block.limit || 8000,
        description: block.description || '',
        preserveOnMigration: block.preserve_on_migration ?? null,
        readOnly: block.read_only || false,
      })) || [];

  // collect memory variables
  const memoryVariables = findMemoryBlockVariables(
    agentState,
  );


  const memoryVariablesAsKeyValue = Object.fromEntries(
    memoryVariables.map((variable) => [variable, '']),
  );


  const agentTemplate: AgentTemplateStateWithNoMetadata = {
    toolIds:
      agentState.tools?.map((tool) => tool.id || '').filter((id) => !!id) ?? [], // Filter out any undefined or null IDs

    sourceIds:
      agentState.sources
        ?.map((source) => source.id || '')
        .filter((id) => !!id) ?? [], // Filter out any undefined or null IDs

    tags: agentState.tags ?? [],
    identityIds: agentState.identity_ids ?? [],

    model: agentState.llm_config.handle,
    toolRules: agentState.tool_rules ?? [],

    systemPrompt: agentState.system || '',

    toolVariables: toolVariablesAsKeyValue
      ? convertRecordMemoryVariablesToMemoryVariablesV1(toolVariablesAsKeyValue)
      : null,

    memoryVariables: convertRecordMemoryVariablesToMemoryVariablesV1(memoryVariablesAsKeyValue),

    // Other Properties - map relevant agent properties
    properties: {
      enable_reasoner: agentState.llm_config?.enable_reasoner ?? false,
      put_inner_thoughts_in_kwargs: agentState.llm_config?.put_inner_thoughts_in_kwargs ?? false,
      context_window_limit: agentState.llm_config?.context_window ?? null,
      max_tokens: agentState.llm_config?.max_tokens ?? null,
      max_reasoning_tokens: agentState.llm_config?.max_reasoning_tokens ?? null,
      max_files_open: agentState.max_files_open ?? null,
      per_file_view_window_char_limit:
        agentState.per_file_view_window_char_limit ?? null,
      message_buffer_autoclear: agentState.message_buffer_autoclear ?? null,
    },
  };


  return {
    agentTemplate,
    agentTemplateBlocks,
  };
}
