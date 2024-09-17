import { AgentsService, SourcesService } from '@letta-web/letta-agents-api';

export async function copyAgentById(agentId: string, name: string) {
  const [currentAgent, agentSources] = await Promise.all([
    AgentsService.getAgent({
      agentId: agentId,
    }),
    AgentsService.getAgentSources({
      agentId: agentId,
    }),
  ]);

  const nextAgent = await AgentsService.createAgent({
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

  if (!nextAgent?.id) {
    throw new Error('Failed to clone agent');
  }

  await Promise.all(
    agentSources.map(async (source) => {
      if (!source.id || !currentAgent.id) {
        return;
      }

      await SourcesService.attachAgentToSource({
        agentId: nextAgent.id || '',
        sourceId: source.id,
      });
    })
  );

  return nextAgent;
}
