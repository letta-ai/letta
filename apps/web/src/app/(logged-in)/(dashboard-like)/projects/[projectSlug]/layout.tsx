import React from 'react';
import { webApiQueryKeys } from '$web/client';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { getProjectByIdOrSlug } from '$web/web-api/router';
import { redirect } from 'next/navigation';
import { ProjectLayoutInner } from './_components/ProjectLayoutInner/ProjectLayoutInner';

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
    queryFn: () => project,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectLayoutInner>{props.children}</ProjectLayoutInner>
    </HydrationBoundary>
  );
}

export default ProjectPageLayout;
