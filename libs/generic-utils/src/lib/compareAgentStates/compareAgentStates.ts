import type { AgentState } from '@letta-cloud/letta-agents-api';
import { isEqual } from 'lodash';

function stateCleaner(state: AgentState) {
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
      .toSorted((a, b) => (a || '').localeCompare(b || '')),
    sourceIds: state.sources
      .map((source) => source.id)
      .toSorted((a, b) => (a || '').localeCompare(b || '')),
    llmConfig: state.llm_config,
    embedding_config: state.embedding_config,
    memoryBlocks: state.memory.blocks
      .map((block) => ({
        value: block.value,
        label: block.label,
      }))
      .toSorted((a, b) => (a.label || '').localeCompare(b.label || '')),
    promptTemplate: state.memory.prompt_template,
    system: state.system,
  };
}

export function compareAgentStates(first: AgentState, second: AgentState) {
  return isEqual(stateCleaner(first), stateCleaner(second));
}
