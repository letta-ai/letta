import {
  AgentsService,
  UseAgentsServiceGetAgentKeyFn,
  webOriginSDKQueryKeys,
} from '@letta-cloud/letta-agents-api';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import React from 'react';
import { db, deployedAgents } from '@letta-cloud/database';
import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { webApiQueryKeys } from '@letta-cloud/web-api-client';
import { getProjectByIdOrSlug } from '$web/web-api/router';
import { AgentPage } from './AgentPage';
import { getUserOrRedirect } from '$web/server/auth';

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

  const deployedAgent = await db.query.deployedAgents.findFirst({
    where: and(
      eq(deployedAgents.id, agentId),
      eq(deployedAgents.organizationId, user.activeOrganizationId),
      isNull(deployedAgents.deletedAt),
    ),
    columns: {
      key: true,
      id: true,
      projectId: true,
      deployedAgentTemplateId: true,
    },
  });

  if (!deployedAgent) {
    redirect(`/projects/${projectSlug}/agents`);
    return;
  }

  if (project.body.id !== deployedAgent.projectId) {
    redirect(`/projects/${projectSlug}/agents`);
    return;
  }

  const agent = await AgentsService.getAgent(
    {
      agentId,
    },
    {
      user_id: user.lettaAgentsId,
    },
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
          metadata_: {
            parentTemplate: deployedAgent.deployedAgentTemplateId,
          },
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
