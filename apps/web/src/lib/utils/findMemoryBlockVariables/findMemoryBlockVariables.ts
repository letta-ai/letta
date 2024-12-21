import type { AgentState } from '@letta-web/letta-agents-api';

export function findMemoryBlockVariables(agentState: AgentState) {
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
