import { AgentPage } from './AgentPage';
import {
  AgentsService,
  UseAgentsServiceGetAgentKeyFn,
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
import { webApiQueryKeys } from '$letta/client';
import { getProjectById } from '$letta/web-api/router';

interface AgentsAgentPageProps {
  params: {
    agentId: string;
    projectId: string;
  };
}

async function AgentsAgentPage(context: AgentsAgentPageProps) {
  const queryClient = new QueryClient();

  const { agentId: testingAgentId, projectId } = context.params;

  const project = await getProjectById({
    params: { projectId },
  });

  if (!project.body || project.status !== 200) {
    redirect('/projects');
    return;
  }

  const testingAgent = await db.query.testingAgents.findFirst({
    where: eq(testingAgents.id, testingAgentId),
    columns: {
      agentId: true,
      name: true,
    },
  });

  if (!testingAgent) {
    redirect(`/projects/${context.params.projectId}`);
    return;
  }

  const { agentId } = testingAgent;

  const agent = await AgentsService.getAgent({
    agentId,
  });

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: UseAgentsServiceGetAgentKeyFn({
        agentId,
      }),
      queryFn: () => agent,
    }),
    queryClient.prefetchQuery({
      queryKey: webApiQueryKeys.projects.getProjectById(projectId),
      queryFn: () => ({
        body: project.body,
      }),
    }),
    queryClient.prefetchQuery({
      queryKey: webApiQueryKeys.projects.getProjectTestingAgent(
        context.params.projectId,
        testingAgentId
      ),
      queryFn: () => ({
        body: testingAgent,
      }),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AgentPage />
    </HydrationBoundary>
  );
}

export default AgentsAgentPage;
