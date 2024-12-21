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
  UseSourcesServiceGetSourceKeyFn,
} from '@letta-web/letta-agents-api';
import { DataSourceClientLayout } from './_components/DataSourceClientLayout/DataSourceClientLayout';

interface ProjectPageWrapperProps {
  params: {
    dataSourceId: string;
  };
  children: React.ReactNode;
}

async function DataSourcePageLayout(props: ProjectPageWrapperProps) {
  const { dataSourceId } = props.params;
  const queryClient = new QueryClient();

  const dataSource = await SourcesService.getSource({
    sourceId: dataSourceId,
  });

  if (!dataSource) {
    redirect('/data-sources');
    return;
  }

  await queryClient.prefetchQuery({
    queryKey: UseSourcesServiceGetSourceKeyFn({
      sourceId: dataSourceId,
    }),
    queryFn: () => dataSource,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DataSourceClientLayout>{props.children}</DataSourceClientLayout>
    </HydrationBoundary>
  );
}

export default DataSourcePageLayout;
