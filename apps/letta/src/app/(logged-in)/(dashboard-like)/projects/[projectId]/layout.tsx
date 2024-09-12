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
import { Frame, HStack, VStack } from '@letta-web/component-library';
import { ProjectPageNavigation } from './ProjectPageNavigation';

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
      <Frame fullHeight fullWidth>
        <HStack fullHeight fullWidth>
          <VStack borderRight>
            <ProjectPageNavigation />
          </VStack>
          {props.children}
        </HStack>
      </Frame>
    </HydrationBoundary>
  );
}

export default ProjectPageLayout;
