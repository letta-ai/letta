import {
  UseAgentsServiceRetrieveAgentKeyFn,
  webOriginSDKQueryKeys,
} from '@letta-cloud/letta-agents-api';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import React from 'react';
import { redirect } from 'next/navigation';
import { webApiQueryKeys } from '@letta-cloud/web-api-client';
import { getProjectByIdOrSlug } from '$web/web-api/router';
import { AgentPage } from './AgentPage';
import { getUserOrRedirect } from '$web/server/auth';
import { sdkRouter } from '$web/sdk/router';

interface AgentsAgentPageProps {
  params: Promise<{
    agentId: string;
    projectSlug: string;
  }>;
}

async function AgentsAgentPage(context: AgentsAgentPageProps) {
  const queryClient = new QueryClient();
  const user = await getUserOrRedirect();

  if (!user) {
    return null;
  }

  const { agentId, projectSlug } = await context.params;

  if (projectSlug === 'development-servers') {
    redirect('/projects');
    return;
  }

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

  const deployedAgent = await sdkRouter.agents.getAgentById(
    {
      params: {
        agent_id: agentId,
      },
      query: {
        template: false,
      },
    },
    {
      request: {
        organizationId: user.activeOrganizationId,
        userId: user.id,
        lettaAgentsUserId: user.lettaAgentsId,
        source: 'web',
      },
    },
  );

  if (!deployedAgent || deployedAgent.status !== 200) {
    redirect(`/projects/${projectSlug}/agents`);
    return;
  }

  if (project.body.id !== deployedAgent.body.metadata_?.projectId) {
    redirect(`/projects/${projectSlug}/agents`);
    return;
  }

  const queries = [
    queryClient.prefetchQuery({
      queryKey: UseAgentsServiceRetrieveAgentKeyFn({
        agentId,
      }),
      queryFn: () => deployedAgent.body,
    }),
    queryClient.prefetchQuery({
      queryKey: webApiQueryKeys.projects.getProjectByIdOrSlug(projectSlug),
      queryFn: () => ({
        body: project.body,
      }),
    }),
    queryClient.prefetchQuery({
      queryKey: webOriginSDKQueryKeys.agents.getAgentById(agentId),
      queryFn: () => deployedAgent,
    }),
  ];

  await Promise.all(queries);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AgentPage />
    </HydrationBoundary>
  );
}

export default AgentsAgentPage;
