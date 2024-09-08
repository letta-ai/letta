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
import { db, testingAgents } from '@letta-web/database';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

interface AgentsAgentPageProps {
  params: {
    agentId: string;
    projectId: string;
  };
}

async function AgentsAgentPage(context: AgentsAgentPageProps) {
  const queryClient = new QueryClient();

  const { agentId: testingAgentId } = context.params;

  const testingAgent = await db.query.testingAgents.findFirst({
    where: eq(testingAgents.id, testingAgentId),
    columns: {
      agentId: true,
    },
  });

  if (!testingAgent) {
    redirect(`/projects/${context.params.projectId}`);
    return;
  }

  const { agentId } = testingAgent;

  const agent = await AgentsService.getAgentStateApiAgentsAgentIdGet({
    agentId,
  });

  await queryClient.prefetchQuery({
    queryKey: UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn({
      agentId: testingAgentId,
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
