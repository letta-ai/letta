import React from 'react';
import { webApiQueryKeys } from '$letta/client';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { getProjectByIdOrSlug } from '$letta/web-api/router';
import { redirect } from 'next/navigation';
import { DashboardWithSidebarWrapper } from '@letta-web/component-library';
import { ProjectAvatar } from './_components/ProjectAvatar/ProjectAvatar';

interface ProjectPageWrapperProps {
  params: {
    projectSlug: string;
  };
  children: React.ReactNode;
}

async function ProjectPageLayout(props: ProjectPageWrapperProps) {
  const { projectSlug } = props.params;
  const queryClient = new QueryClient();

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

  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.projects.getProjectByIdOrSlug(projectSlug),
    queryFn: () => ({
      body: project.body,
    }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardWithSidebarWrapper
        baseUrl="/projects"
        projectTitle={<ProjectAvatar />}
        navigationItems={[
          {
            label: 'Project Home',
            href: `/projects/${projectSlug}`,
          },
          {
            label: 'Deployments',
            href: `/projects/${projectSlug}/deployments`,
          },
          {
            label: 'Agents',
            href: `/projects/${projectSlug}/agents`,
          },
          {
            label: 'Settings',
            href: `/projects/${projectSlug}/settings`,
          },
        ]}
      >
        {props.children}
      </DashboardWithSidebarWrapper>
    </HydrationBoundary>
  );
}

export default ProjectPageLayout;
