import type {
  AgentState,
  EmbeddingConfig,
  LLMConfig,
} from '@letta-cloud/sdk-core';
import { isEqual } from 'lodash';

interface CleanedMemoryBlock {
  value: string;
  label: string;
  limit: number;
  read_only: boolean;
  preserve_on_migration: boolean;
  description: string;
}

export interface CleanedAgentState {
  tool_exec_environment_variables?: Array<{ key: string; value: string }>;
  toolIds: string[];
  sourceIds: string[];
  llmConfig: LLMConfig;
  embedding_config: EmbeddingConfig;
  memoryBlocks: CleanedMemoryBlock[];
  // temp hidden since its not editable in ade
  // promptTemplate: string;
  system: string;
  toolRules: AgentState['tool_rules'];
}

export function stateCleaner(state: AgentState): CleanedAgentState {
  // only compare the following properties

  return {
    tool_exec_environment_variables: state.tool_exec_environment_variables
      ?.map((item) => ({
        key: item.key,
        value: item.value,
      }))
      .toSorted((a, b) => (a.key || '').localeCompare(b.key || '')),
    toolIds: (state.tools || [])
      .map((tool) => tool.id)
      .filter((id) => !!id)
      .toSorted((a, b) => (a || '').localeCompare(b || '')) as string[],
    sourceIds: (state.sources || [])
      .map((source) => source.id)
      .filter((id) => !!id)
      .toSorted((a, b) => (a || '').localeCompare(b || '')) as string[],
    llmConfig: {
      model: state.llm_config.model,
      model_endpoint_type: state.llm_config.model_endpoint_type,
      model_endpoint: state.llm_config.model_endpoint,
      model_wrapper: state.llm_config.model_wrapper,
      context_window: state.llm_config.context_window,
      enable_reasoner: state.llm_config.enable_reasoner,
      put_inner_thoughts_in_kwargs: state.llm_config.put_inner_thoughts_in_kwargs,
      temperature: state.llm_config.temperature,
      max_tokens: state.llm_config.max_tokens,
      max_reasoning_tokens: state.llm_config.max_reasoning_tokens,
    },
    embedding_config: {
      embedding_model: state.embedding_config.embedding_model,
      embedding_endpoint_type: state.embedding_config.embedding_endpoint_type,
      embedding_dim: state.embedding_config.embedding_dim,
      embedding_chunk_size: state.embedding_config.embedding_chunk_size,
    },
    toolRules: state.tool_rules
      ?.map(({ prompt_template: _p, ...rule }) => ({
        ...rule,
      }))
      .toSorted((a, b) => {
        // sort by tool_type then by name
        const typeComparison = (a.type || '').localeCompare(b.type || '');

        if (typeComparison !== 0) return typeComparison;

        return (a.tool_name || '').localeCompare(b.tool_name || '');
      }),
    memoryBlocks: state.memory
      ? state.memory.blocks
          .map((block) => ({
            value: block.value || '',
            label: block.label || '',
            read_only: block.read_only || false,
            preserve_on_migration: block.preserve_on_migration || false,
            description: block.description || '',
            limit: block.limit || 0,
          }))
          .toSorted((a, b) => (a.label || '').localeCompare(b.label || ''))
      : [],
    // temp hidden since its not editable in ade and not supported in agentfile
    // promptTemplate: state.memory?.prompt_template || '',
    system: state.system,
  };
}

export function compareAgentStates(first: AgentState, second: AgentState) {
  return isEqual(stateCleaner(first), stateCleaner(second));
}
