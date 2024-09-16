'use server';
import React from 'react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { redirect } from 'next/navigation';
import {
  Avatar,
  DashboardWithSidebarWrapper,
} from '@letta-web/component-library';
import {
  SourcesService,
  UseSourcesServiceGetSourceKeyFn,
} from '@letta-web/letta-agents-api';

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
      <DashboardWithSidebarWrapper
        projectTitle={
          <>
            <Avatar name={dataSource.name} />
            {dataSource.name}
          </>
        }
        navigationItems={[
          {
            label: 'Source Info',
            href: `/data-sources/${dataSourceId}`,
          },
          // {
          //   label: 'Settings',
          //   href: `/data-sources/${dataSourceId}/settings`,
          // },
        ]}
      >
        {props.children}
      </DashboardWithSidebarWrapper>
    </HydrationBoundary>
  );
}

export default DataSourcePageLayout;
