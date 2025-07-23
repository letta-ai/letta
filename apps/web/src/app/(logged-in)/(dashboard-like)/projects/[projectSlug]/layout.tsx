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
import { cookies } from 'next/headers';
import { getADEConfigConstants } from '@letta-cloud/utils-shared';

interface ProjectPageWrapperProps {
  params: Promise<{
    projectSlug: string;
  }>;
  children: React.ReactNode;
}

const { ADELayoutCookieName, ADELayoutQueryKey, deserializeADELayoutConfig } = getADEConfigConstants();

async function ProjectPageLayout(props: ProjectPageWrapperProps) {
  const { projectSlug } = await props.params;
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

  await queryClient.prefetchQuery({
    queryKey: ADELayoutQueryKey,
    queryFn: async () => {
      try {
        const cookie = await cookies();

        return deserializeADELayoutConfig(cookie.get(ADELayoutCookieName)?.value || '');
      } catch (_e) {
        return undefined;
      }
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectLayoutInner>{props.children}</ProjectLayoutInner>
    </HydrationBoundary>
  );
}

export default ProjectPageLayout;
