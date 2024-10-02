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
import { getProjectByIdOrSlug } from '$letta/web-api/router';
import { AgentPage } from './AgentPage';

interface AgentsAgentPageProps {
  params: {
    agentName: string;
    projectSlug: string;
  };
}

async function AgentsAgentPage(context: AgentsAgentPageProps) {
  const queryClient = new QueryClient();

  const { agentName, projectSlug } = context.params;

  const project = await getProjectByIdOrSlug({
    params: { projectId: projectSlug },
    query: {
      lookupBy: 'slug',
    },
  });

  if (!project.body || project.status !== 200) {
    redirect('/projects');
    return;
  }

  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: eq(agentTemplates.name, agentName),
    columns: {
      name: true,
      id: true,
    },
  });

  if (!agentTemplate) {
    redirect(`/projects/${context.params.projectSlug}`);
    return;
  }

  const agent = await AgentsService.getAgent({
    agentId: agentTemplate.id,
  });

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: UseAgentsServiceGetAgentKeyFn({
        agentId: agentTemplate.id,
      }),
      queryFn: () => agent,
    }),
    queryClient.prefetchQuery({
      queryKey: webApiQueryKeys.projects.getProjectByIdOrSlug(projectSlug),
      queryFn: () => ({
        body: project.body,
      }),
    }),
    queryClient.prefetchQuery({
      queryKey: webApiQueryKeys.projects.getTestingAgentByIdOrName(
        agentTemplate.name
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
