import type {
  AgentStateForSynchronization
} from '../synchronizeSimulatedAgentWithAgentTemplate/synchronizeSimulatedAgentWithAgentTemplate';
import type { AgentState } from '@letta-cloud/sdk-core';

export function findMemoryBlockVariables(agentState: AgentState | AgentStateForSynchronization) {
  // find all instances {{variable}} in memory blocks

  const list = new Set<string>();
  const memoryBlocks = agentState.memory?.blocks || [];

  memoryBlocks.forEach((memoryBlock) => {
    const regex = /\{\{.*?\}\}/g;
    const matches = memoryBlock.value.match(regex);
    if (matches) {
      matches.forEach((match) => {
        // remove braces
        list.add(match.slice(2, -2));
      });
    }
  }, 0);

  return Array.from(list);
}
