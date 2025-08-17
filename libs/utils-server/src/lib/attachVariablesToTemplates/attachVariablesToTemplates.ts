import type { AgentState, CreateAgentRequest } from '@letta-cloud/sdk-core';
import { attachMemoryVariablesToBlockValue } from '@letta-cloud/utils-shared';

export function attachVariablesToTemplates(
  agentTemplate: AgentState,
  memoryVariables?: CreateAgentRequest['memory_variables'],
) {
  const memoryBlockValues = agentTemplate.memory.blocks.map((block) => {
    if (memoryVariables && typeof block.value === 'string') {
      return {
        ...block,
        value: attachMemoryVariablesToBlockValue(
          block.value,
          memoryVariables || {},
        ),
      };
    }

    return block;
  }, []);

  return {
    tool_ids:
      agentTemplate.tools?.map((tool) => tool.id || '').filter(Boolean) || [],
    memory_blocks: memoryBlockValues,
  };
}
