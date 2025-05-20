import {
  isAPIError,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import React from 'react';
import { redirect } from 'next/navigation';
import { webApiQueryKeys } from '@letta-cloud/sdk-web';
import { getProjectByIdOrSlug } from '$web/web-api/router';
import { getUserOrRedirect } from '$web/server/auth';
import { CloudAgentEditor } from '$web/client/components/CloudAgentEditor/CloudAgentEditor';
import { cloudApiRouter } from 'tmp-cloud-api-router';
import { cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { ADEError } from '$web/client/components/ADEError/ADEError';
import { db, projects } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

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

  const deployedAgent = await cloudApiRouter.agents
    .getAgentById(
      {
        params: {
          agent_id: agentId,
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
    )
    .catch((e) => {
      if (isAPIError(e) && e.status === 404) {
        return null;
      }

      throw e;
    });

  if (!deployedAgent || deployedAgent.status !== 200) {
    return <ADEError errorCode="agentNotFound" />;
  }

  if (!deployedAgent.body.project_id) {
    return <ADEError errorCode="agentNotFound" />;
  }

  if (project.body.id !== deployedAgent.body.project_id) {
    const nextProject = await db.query.projects.findFirst({
      where: eq(projects.id, deployedAgent.body.project_id),
    });

    if (!nextProject) {
      return <ADEError errorCode="agentNotFound" />;
    }

    redirect(`/projects/${nextProject.slug}/agents/${agentId}`);
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
      queryKey: cloudQueryKeys.agents.getAgentById(agentId),
      queryFn: () => deployedAgent,
    }),
  ];

  await Promise.all(queries);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CloudAgentEditor />
    </HydrationBoundary>
  );
}

export default AgentsAgentPage;
