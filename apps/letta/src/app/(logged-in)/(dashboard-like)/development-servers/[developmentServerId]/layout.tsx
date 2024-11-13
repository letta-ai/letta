'use server';
import React from 'react';
import { redirect } from 'next/navigation';
import { developmentServersRouter } from '$letta/web-api/development-servers/developmentServersRouter';
import { LettaAgentsAPIWrapper } from '@letta-web/letta-agents-api';
import { LOCAL_PROJECT_SERVER_URL } from '$letta/constants';
import { webApiQueryKeys } from '$letta/client';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { DevelopmentServerWrapper } from './components/DevelopmentServerWrapper/DevelopmentServerWrapper';

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
    return (
      <LettaAgentsAPIWrapper baseUrl={LOCAL_PROJECT_SERVER_URL}>
        {children}
      </LettaAgentsAPIWrapper>
    );
  }

  const developmentServer = await developmentServersRouter.getDevelopmentServer(
    {
      params: {
        developmentServerId,
      },
    }
  );

  if (!developmentServer || developmentServer.status !== 200) {
    return redirect('/development-servers/dashboard');
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
