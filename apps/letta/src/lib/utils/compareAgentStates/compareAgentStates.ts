import type { AgentState } from '@letta-web/letta-agents-api';
import { isEqual, pick } from 'lodash-es';

function stateCleaner(state: AgentState) {
  // only compare the following properties
  const picker = pick(state, [
    'system',
    'llm_config',
    'embedding_config',
    'memory',
    'tools',
    'sources',
  ]);

  return {
    toolIds: picker.tools
      .map((tool) => tool.id)
      .toSorted((a, b) => (a || '').localeCompare(b || '')),
    sourceIds: picker.sources
      .map((source) => source.id)
      .toSorted((a, b) => (a || '').localeCompare(b || '')),
    llmConfig: picker.llm_config,
    embedding_config: picker.embedding_config,
    memoryBlocks: picker.memory.blocks
      .map((block) => ({
        value: block.value,
        label: block.label,
      }))
      .toSorted((a, b) => (a.label || '').localeCompare(b.label || '')),
    promptTemplate: picker.memory.prompt_template,
    system: picker.system,
  };
}

export function compareAgentStates(first: AgentState, second: AgentState) {
  return isEqual(stateCleaner(first), stateCleaner(second));
}
