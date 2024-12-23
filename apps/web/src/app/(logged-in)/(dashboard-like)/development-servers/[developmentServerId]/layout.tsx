'use server';
import React from 'react';
import { redirect } from 'next/navigation';
import { webApiQueryKeys } from '$web/client';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { DevelopmentServerWrapper } from './components/DevelopmentServerWrapper/DevelopmentServerWrapper';
import { router } from '$web/web-api/router';

interface LocalServiceLayoutProps {
  children: React.ReactNode;
  params: {
    developmentServerId: string;
  };
}

async function LocalServiceLayout(props: LocalServiceLayoutProps) {
  const {
    children,
    params: { developmentServerId },
  } = props;
  const queryClient = new QueryClient();

  if (developmentServerId === 'local') {
    return <DevelopmentServerWrapper>{children}</DevelopmentServerWrapper>;
  }

  const developmentServer =
    await router.developmentServers.getDevelopmentServer({
      params: {
        developmentServerId,
      },
    });

  if (!developmentServer || developmentServer.status !== 200) {
    return redirect('/development-servers/local/dashboard');
  }

  await queryClient.prefetchQuery({
    queryKey:
      webApiQueryKeys.developmentServers.getDevelopmentServer(
        developmentServerId
      ),
    queryFn: () => ({
      body: developmentServer.body,
    }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DevelopmentServerWrapper>{children}</DevelopmentServerWrapper>
    </HydrationBoundary>
  );
}

export default LocalServiceLayout;
