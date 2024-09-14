'use server';
import React from 'react';
import { webApiQueryKeys } from '$letta/client';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { getProjectById } from '$letta/web-api/router/projects';
import { redirect } from 'next/navigation';
import {
  Avatar,
  DashboardWithSidebarWrapper,
} from '@letta-web/component-library';

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
        projectTitle={
          <>
            <Avatar name={project.body.name} />
            {project.body.name}
          </>
        }
        navigationItems={[
          {
            label: 'Project Home',
            href: `/projects/${projectId}`,
          },
          {
            label: 'Staging',
            href: `/projects/${projectId}/staging`,
            highlightSubPaths: true,
          },
          {
            label: 'Deployments',
            href: `/projects/${projectId}/deployments`,
            highlightSubPaths: true,
          },
        ]}
      >
        {props.children}
      </DashboardWithSidebarWrapper>
    </HydrationBoundary>
  );
}

export default ProjectPageLayout;
