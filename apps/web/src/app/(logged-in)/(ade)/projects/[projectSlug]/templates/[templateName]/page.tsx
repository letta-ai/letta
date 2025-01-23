import {
  AgentsService,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/letta-agents-api';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import React from 'react';
import { db, agentTemplates } from '@letta-cloud/database';
import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { webApiQueryKeys, webOriginSDKQueryKeys } from '$web/client';
import { getProjectByIdOrSlug } from '$web/web-api/router';
import { AgentPage } from '../../agents/[agentId]/AgentPage';
import { getUserOrRedirect } from '$web/server/auth';

interface AgentsAgentPageProps {
  params: Promise<{
    templateName: string;
    projectSlug: string;
  }>;
}

async function AgentsAgentPage(context: AgentsAgentPageProps) {
  const queryClient = new QueryClient();
  const user = await getUserOrRedirect();

  if (!user) {
    return null;
  }

  const { templateName, projectSlug } = await context.params;

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
    where: and(
      eq(agentTemplates.name, templateName),
      eq(agentTemplates.organizationId, user.activeOrganizationId),
      isNull(agentTemplates.deletedAt),
    ),
    columns: {
      name: true,
      id: true,
    },
  });

  const agentId = agentTemplate?.id;

  if (!agentId) {
    redirect(`/projects/${projectSlug}/agents`);
    return;
  }

  const agent = await AgentsService.retrieveAgent(
    {
      agentId,
    },
    {
      user_id: user.lettaAgentsId,
    },
  );

  const queries = [
    queryClient.prefetchQuery({
      queryKey: UseAgentsServiceRetrieveAgentKeyFn({
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
      queryKey: webOriginSDKQueryKeys.agents.listAgentsWithSearch({
        name: agentTemplate.name,
        template: true,
      }),
      queryFn: () => ({
        body: [agentTemplate],
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
