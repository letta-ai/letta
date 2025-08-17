import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import React from 'react';
import {
  db,
  lettaTemplates,
  simulatedAgent,
} from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { webApiQueryKeys } from '$web/client';
import {
  convertAgentTemplateToPayload,
  getProjectByIdOrSlug,
} from '$web/web-api/router';
import { getUserOrRedirect } from '$web/server/auth';
import { cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import type { ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import type { AgentState} from '@letta-cloud/sdk-core';
import { AgentsService, UseAgentsServiceRetrieveAgentKeyFn } from '@letta-cloud/sdk-core';

interface TemplateBaseLayoutProps {
  params: Promise<{
    templateName: string;
    projectSlug: string;
  }>;
  children: React.ReactNode;
}

async function TemplateBaseLayout(props: TemplateBaseLayoutProps) {
  const { children } = props;
  const queryClient = new QueryClient();
  const user = await getUserOrRedirect();

  if (!user) {
    return null;
  }

  const { templateName, projectSlug } = await props.params;

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

  const template = await db.query.lettaTemplates.findFirst({
    where: and(
      eq(lettaTemplates.name, templateName),
      eq(lettaTemplates.organizationId, user.activeOrganizationId),
      eq(lettaTemplates.projectId, project.body.id),
      eq(lettaTemplates.version, 'current'),
    ),
    with: {
      agentTemplates: {
        limit: 1,
        with: {
          simulatedAgents: {
            limit: 1,
            where: eq(simulatedAgent.isDefault, true),
          },
        },
      },
    },
    columns: {
      name: true,
      projectId: true,
      id: true,
    },
  });



  if (!template) {
    redirect(`/projects/${projectSlug}/agents`);
    return;
  }

 let agent: AgentState | undefined;

  const { agentTemplates, ...selectedTemplate } = template;

  const defaultAgentTemplate = agentTemplates[0];

  const defaultSimulatedAgent = defaultAgentTemplate?.simulatedAgents[0];

  if (defaultSimulatedAgent) {
    agent = await AgentsService.retrieveAgent({
      agentId: defaultSimulatedAgent.agentId,
    }, {
      user_id: user.lettaAgentsId,
    }).catch(() => undefined);
  }


  const queries = [
    queryClient.prefetchQuery({
      queryKey: webApiQueryKeys.projects.getProjectByIdOrSlug(projectSlug),
      queryFn: () => ({
        body: project.body,
      }),
    }),
    queryClient.prefetchQuery({
      queryKey: cloudQueryKeys.templates.listTemplatesWithSearch({
        project_slug: projectSlug,
        name: templateName,
      }),
      queryFn: () => ({
        body: {
          templates: [selectedTemplate],
        },
      }),
    }),
    ...(defaultAgentTemplate
      ? [
          queryClient.prefetchQuery({
            queryKey: webApiQueryKeys.templates.getAgentTemplateByEntityId(
              template.id,
              'default',
            ),
            queryFn: () => ({
              body: convertAgentTemplateToPayload(defaultAgentTemplate),
            }),
          }),
        ]
      : []),
    ...(defaultSimulatedAgent && defaultAgentTemplate
      ? [
          queryClient.prefetchQuery<
            ServerInferResponses<
              typeof contracts.simulatedAgents.getDefaultSimulatedAgent
            >
          >({
            queryKey: webApiQueryKeys.simulatedAgents.getDefaultSimulatedAgent(
              defaultAgentTemplate.id,
            ),
            queryFn: () => ({
              status: 200,
              body: {
                name: '',
                agentTemplateId: defaultAgentTemplate.id,
                isCorrupted: !agent,
                agentId: defaultSimulatedAgent.agentId,
                id: defaultSimulatedAgent.id,
              },
            }),
          }),
        ]
      : []),
    ...(agent ? [
      queryClient.prefetchQuery<AgentState>({
        queryKey: UseAgentsServiceRetrieveAgentKeyFn({
          agentId: agent.id,
        }),
        queryFn: () => agent,
      }),
    ] : []),
  ];

  await Promise.all(queries);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}

export default TemplateBaseLayout;
