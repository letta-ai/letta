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
import { db, deployedAgents } from '@letta-web/database';
import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { webApiQueryKeys, webOriginSDKQueryKeys } from '$letta/client';
import { getProjectByIdOrSlug } from '$letta/web-api/router';
import { AgentPage } from './AgentPage';
import { getUserOrRedirect } from '$letta/server/auth';

interface AgentsAgentPageProps {
  params: {
    agentId: string;
    projectSlug: string;
  };
}

async function AgentsAgentPage(context: AgentsAgentPageProps) {
  const queryClient = new QueryClient();
  const user = await getUserOrRedirect();

  if (!user) {
    return null;
  }

  const { agentId, projectSlug } = context.params;

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

  const deployedAgent = await db.query.deployedAgents.findFirst({
    where: and(
      eq(deployedAgents.id, agentId),
      eq(deployedAgents.organizationId, user.activeOrganizationId),
      isNull(deployedAgents.deletedAt)
    ),
    columns: {
      key: true,
      id: true,
    },
  });

  if (!deployedAgent) {
    redirect(`/projects/${projectSlug}/agents`);
    return;
  }

  const agent = await AgentsService.getAgent(
    {
      agentId,
    },
    {
      user_id: user.lettaAgentsId,
    }
  );

  const queries = [
    queryClient.prefetchQuery({
      queryKey: UseAgentsServiceGetAgentKeyFn({
        agentId,
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
      queryKey: webOriginSDKQueryKeys.agents.getAgentById(deployedAgent.id),
      queryFn: () => ({
        body: {
          name: deployedAgent.key,
          id: deployedAgent.id,
        },
      }),
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
