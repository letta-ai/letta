import React from 'react';
import { webApiQueryKeys } from '$letta/client';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { getProjectById } from '$letta/web-api/router/projects';
import { redirect } from 'next/navigation';
import { DashboardWithSidebarWrapper } from '@letta-web/component-library';
import { ProjectAvatar } from './_components/ProjectAvatar/ProjectAvatar';

interface ProjectPageWrapperProps {
  params: {
    projectId: string;
  };
  children: React.ReactNode;
}

async function ProjectPageLayout(props: ProjectPageWrapperProps) {
  const { projectId } = props.params;
  const queryClient = new QueryClient();

  const project = await getProjectById({
    params: { projectId },
  });

  if (!project.body || project.status !== 200) {
    redirect('/projects');
    return;
  }

  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.projects.getProjectById(projectId),
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
            href: `/projects/${projectId}`,
          },
          {
            label: 'Deployments',
            href: `/projects/${projectId}/deployments`,
          },
          {
            label: 'Agents',
            href: `/projects/${projectId}/agents`,
          },
          {
            label: 'Settings',
            href: `/projects/${projectId}/settings`,
          },
        ]}
      >
        {props.children}
      </DashboardWithSidebarWrapper>
    </HydrationBoundary>
  );
}

export default ProjectPageLayout;
