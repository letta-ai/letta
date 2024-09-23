import type { AgentState, UpdateAgentState } from '@letta-web/letta-agents-api';
import { AgentsService, SourcesService } from '@letta-web/letta-agents-api';
import type { AgentTemplate } from '$letta/types';

export async function createAgentFromTemplate(
  agentTemplate: AgentTemplate,
  name: string,
  userId: string
) {
  return AgentsService.createAgent({
    requestBody: {
      tools: agentTemplate.tools,
      name: name,
      embedding_config: agentTemplate.embedding_config,
      description: '',
      memory: agentTemplate.memory,
      user_id: userId,
      llm_config: agentTemplate.llm_config,
    },
  });
}

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

interface MigrateToNewAgentArgs {
  agentTemplate: AgentState;
  preserveCoreMemories?: boolean;
  agentIdToMigrate: string;
  agentDatasourcesIds: string[];
}

export async function migrateToNewAgent(options: MigrateToNewAgentArgs) {
  const {
    agentTemplate,
    preserveCoreMemories = false,
    agentIdToMigrate,
    agentDatasourcesIds,
  } = options;
  const oldDatasources = await AgentsService.getAgentSources({
    agentId: agentIdToMigrate,
  });

  // TODO: https://linear.app/letta/issue/LET-91/handle-detach-datasource-in-migration
  const _datasourcesToDetach = oldDatasources.filter(
    ({ id }) =>
      !agentDatasourcesIds.some((newDatasource) => newDatasource === id)
  );

  const datasourceIdsToAttach = agentDatasourcesIds.filter(
    (id) => !oldDatasources.some((oldDatasource) => oldDatasource.id === id)
  );

  const requestBody: UpdateAgentState = {
    id: agentIdToMigrate,
    tools: agentTemplate.tools,
  };

  if (!preserveCoreMemories) {
    requestBody.memory = agentTemplate.memory;
  }

  await AgentsService.updateAgent({
    agentId: agentIdToMigrate,
    requestBody: requestBody,
  });

  await Promise.all([
    Promise.all(
      datasourceIdsToAttach.map(async (datasource) => {
        return SourcesService.attachAgentToSource({
          agentId: agentIdToMigrate,
          sourceId: datasource || '',
        });
      })
    ),
  ]);
}
