'use server';
import React from 'react';
import { webApiQueryKeys } from '$letta/client';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { getProjectById } from '$letta/server/router/projects';
import { redirect } from 'next/navigation';

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

  if (!project.body) {
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
      {props.children}
    </HydrationBoundary>
  );
}

export default ProjectPageLayout;
