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
import { db, agentTemplates } from '@letta-web/database';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { webApiQueryKeys } from '$letta/client';
import { getProjectById } from '$letta/web-api/router';
import { AgentPage } from './AgentPage';

interface AgentsAgentPageProps {
  params: {
    agentId: string;
    projectId: string;
  };
}

async function AgentsAgentPage(context: AgentsAgentPageProps) {
  const queryClient = new QueryClient();

  const { agentId, projectId } = context.params;

  const project = await getProjectById({
    params: { projectId },
  });

  if (!project.body || project.status !== 200) {
    redirect('/projects');
    return;
  }

  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: eq(agentTemplates.id, agentId),
    columns: {
      name: true,
      id: true,
    },
  });

  if (!agentTemplate) {
    redirect(`/projects/${context.params.projectId}`);
    return;
  }

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
      queryKey: webApiQueryKeys.projects.getProjectAgentTemplate(
        context.params.projectId,
        agentId
      ),
      queryFn: () => ({
        body: agentTemplate,
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
