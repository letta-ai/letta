import type {
  AgentState,
  CreateAgentRequest,
} from '@letta-cloud/letta-agents-api';

export function attachVariablesToTemplates(
  agentTemplate: AgentState,
  memoryVariables?: CreateAgentRequest['memory_variables'],
) {
  const memoryBlockValues = agentTemplate.memory.blocks.map((block) => {
    if (memoryVariables && typeof block.value === 'string') {
      return {
        ...block,
        value: block.value.replace(/{{(.*?)}}/g, (_m, p1) => {
          return memoryVariables?.[p1] || '';
        }),
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
