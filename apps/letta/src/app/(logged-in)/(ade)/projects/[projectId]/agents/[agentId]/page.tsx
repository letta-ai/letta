import { AgentPage } from './AgentPage';
import {
  AgentsService,
  UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn,
} from '@letta-web/letta-agents-api';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import React from 'react';

interface AgentsAgentPageProps {
  params: {
    agentId: string;
  };
}

async function AgentsAgentPage(context: AgentsAgentPageProps) {
  const queryClient = new QueryClient();

  const { agentId } = context.params;

  const agent = await AgentsService.getAgentStateApiAgentsAgentIdGet({
    agentId,
  });

  await queryClient.prefetchQuery({
    queryKey: UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn({
      agentId,
    }),
    queryFn: () => agent,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AgentPage />
    </HydrationBoundary>
  );
}

export default AgentsAgentPage;
