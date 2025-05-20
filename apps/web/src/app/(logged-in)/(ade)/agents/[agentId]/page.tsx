import { cloudApiRouter } from 'tmp-cloud-api-router';
import { isAPIError } from '@letta-cloud/sdk-core';
import { getUserOrRedirect } from '$web/server/auth';
import { db, projects } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { ADEError } from '$web/client/components/ADEError/ADEError';
import { redirect } from 'next/navigation';
import React from 'react';

interface AgentsAgentPageProps {
  params: Promise<{
    agentId: string;
    projectSlug: string;
  }>;
}

export default async function AgentSearchPage(context: AgentsAgentPageProps) {
  const user = await getUserOrRedirect();

  if (!user) {
    return null;
  }

  const { agentId } = await context.params;

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

  const nextProject = await db.query.projects.findFirst({
    where: eq(projects.id, deployedAgent.body.project_id),
  });

  if (!nextProject) {
    return <ADEError errorCode="agentNotFound" />;
  }

  redirect(`/projects/${nextProject.slug}/agents/${agentId}`);
  return null;
}
