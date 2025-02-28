import React from 'react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { router } from '$web/web-api/router';
import { redirect } from 'next/navigation';
import { webApiQueryKeys } from '@letta-cloud/web-api-client';

interface ChatLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    launchId: string;
  }>;
}

export default async function LaunchLayout(props: ChatLayoutProps) {
  const { children, params } = props;

  const { launchId } = await params;
  const queryClient = new QueryClient();

  const launchLinkDetails =
    await router.launchLinks.getLaunchLinkMetadataByLaunchId({
      params: {
        launchId,
      },
    });

  if (launchLinkDetails.status !== 200 || !launchLinkDetails.body) {
    redirect('/');
    return null;
  }

  await queryClient.prefetchQuery({
    queryKey:
      webApiQueryKeys.launchLinks.getLaunchLinkMetadataByLaunchId(launchId),
    queryFn: () => launchLinkDetails,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
