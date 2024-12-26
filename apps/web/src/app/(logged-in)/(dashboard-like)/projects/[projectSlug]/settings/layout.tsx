import type React from 'react';
import { router } from '$web/web-api/router';
import { redirect } from 'next/navigation';
import { webApiQueryKeys } from '$web/client';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';

interface ProjectSettingsLayoutProps {
  children: React.ReactNode;
}

export default async function ProjectSettingsLayout(
  props: ProjectSettingsLayoutProps
) {
  const res = await router.organizations.getCurrentOrganizationPreferences();

  const queryClient = new QueryClient();

  if (!res.body || res.status !== 200) {
    redirect('/projects');
    return;
  }
  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganizationPreferences,
    queryFn: () => res,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
