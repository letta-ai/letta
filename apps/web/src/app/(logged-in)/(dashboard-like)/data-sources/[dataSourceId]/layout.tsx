'use server';
import React from 'react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { redirect } from 'next/navigation';
import {
  SourcesService,
  UseSourcesServiceRetrieveSourceKeyFn,
} from '@letta-cloud/sdk-core';
import { getUser } from '$web/server/auth';

interface ProjectPageWrapperProps {
  params: Promise<{
    dataSourceId: string;
  }>;
  children: React.ReactNode;
}

async function DataSourcePageLayout(props: ProjectPageWrapperProps) {
  const { dataSourceId } = await props.params;
  const queryClient = new QueryClient();
  const user = await getUser();

  if (!user?.lettaAgentsId) {
    redirect('/login');
    return;
  }

  const dataSource = await SourcesService.retrieveSource(
    {
      sourceId: dataSourceId,
    },
    {
      user_id: user.lettaAgentsId,
    },
  ).catch(() => {
    return null;
  });

  if (!dataSource) {
    redirect('/data-sources');
    return;
  }

  await queryClient.prefetchQuery({
    queryKey: UseSourcesServiceRetrieveSourceKeyFn({
      sourceId: dataSourceId,
    }),
    queryFn: () => dataSource,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

export default DataSourcePageLayout;
