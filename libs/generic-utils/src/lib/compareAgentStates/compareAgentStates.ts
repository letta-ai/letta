import type {
  AgentState,
  EmbeddingConfig,
  LLMConfig,
} from '@letta-cloud/letta-agents-api';
import { isEqual } from 'lodash-es';

interface CleanedMemoryBlock {
  value: string;
  label: string;
  limit: number;
}

export interface CleanedAgentState {
  tool_exec_environment_variables?: Array<{ key: string; value: string }>;
  toolIds: string[];
  sourceIds: string[];
  llmConfig: LLMConfig;
  embedding_config: EmbeddingConfig;
  memoryBlocks: CleanedMemoryBlock[];
  promptTemplate: string;
  system: string;
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
    toolIds: state.tools
      .map((tool) => tool.id)
      .filter((id) => !!id)
      .toSorted((a, b) => (a || '').localeCompare(b || '')) as string[],
    sourceIds: state.sources
      .map((source) => source.id)
      .filter((id) => !!id)
      .toSorted((a, b) => (a || '').localeCompare(b || '')) as string[],
    llmConfig: state.llm_config,
    embedding_config: state.embedding_config,
    memoryBlocks: state.memory.blocks
      .map((block) => ({
        value: block.value || '',
        label: block.label || '',
        limit: block.limit || 0,
      }))
      .toSorted((a, b) => (a.label || '').localeCompare(b.label || '')),
    promptTemplate: state.memory.prompt_template || '',
    system: state.system,
  };
}

export function compareAgentStates(first: AgentState, second: AgentState) {
  return isEqual(stateCleaner(first), stateCleaner(second));
}
