import { AgentsService } from '@letta-web/letta-agents-api';

export async function copyAgentById(agentId: string, name: string) {
  const currentAgent = await AgentsService.getAgent({
    agentId: agentId,
  });

  return AgentsService.createAgent({
    requestBody: {
      tools: currentAgent.tools,
      name: name,
      embedding_config: currentAgent.embedding_config,
      description: currentAgent.description,
      memory: currentAgent.memory,
      user_id: currentAgent.user_id,
      llm_config: currentAgent.llm_config,
    },
  });
}
