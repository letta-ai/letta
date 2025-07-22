'use client';
import React, { Fragment, useMemo } from 'react';
import {
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
  IndeterminateProgress,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import type { Job } from '@letta-cloud/sdk-core';
import {
  useJobsServiceListActiveJobs,
  useSourcesServiceRetrieveSource,
} from '@letta-cloud/sdk-core';
import { useCurrentDataSourceId } from './hooks';
import type { ColumnDef } from '@tanstack/react-table';
import { useCurrentUser } from '$web/client/hooks';
import { useTranslations } from '@letta-cloud/translations';

const columns: Array<
  ColumnDef<{
    detail: string;
    name: string;
  }>
> = [
  {
    header: 'Name',
    accessorKey: 'name',
  },
  {
    header: 'Detail',
    accessorKey: 'detail',
  },
];

function DataSourceInfo() {
  const t = useTranslations('data-sources/home/page');
  const dataSourceId = useCurrentDataSourceId();
  const { data } = useSourcesServiceRetrieveSource({
    sourceId: dataSourceId,
  });

  const tableData = useMemo(() => {
    if (!data?.embedding_config) {
      return [];
    }

    const configData = Object.entries({
      ...data.embedding_config,
      ...data.metadata,
    })
      .map(([key, value]) => ({
        name: key,
        detail: typeof value === 'string' ? value : JSON.stringify(value),
      }))
      .filter((row) => row.detail !== undefined);

    const instructionsRow = data.instructions
      ? [{ name: t('instructions'), detail: data.instructions }]
      : [];

    return [...instructionsRow, ...configData];
  }, [data, t]);

  return <DataTable columns={columns} data={tableData} />;
}

interface JobItemProps {
  job: Job;
}

function JobItem(props: JobItemProps) {
  const { job } = props;
  const { metadata } = job;

  const contentName = useMemo(() => {
    const filename = metadata?.filename;

    if (typeof filename === 'string') {
      return `Processing ${filename}`;
    }

    return 'Processing unknown file';
  }, [metadata?.filename]);

  return (
    <HStack fullWidth>
      <IndeterminateProgress
        content={contentName}
        statusMessage="Indeterminate time"
      />
    </HStack>
  );
}

function DashboardJobList() {
  const user = useCurrentUser();
  const { data } = useJobsServiceListActiveJobs(
    { userId: user?.id },
    undefined,
    {
      refetchInterval: 5000,
      enabled: !!user?.id,
    },
  );

  if (!data || data?.length === 0) {
    return null;
  }

  return (
    <VStack gap={false} fullWidth border>
      <HStack padding="small" borderBottom>
        <Typography bold>Active Jobs</Typography>
      </HStack>
      <VStack paddingX="small" paddingY="large" gap="large" fullWidth>
        {data?.map((job, index) => (
          <Fragment key={job.id}>
            <JobItem key={job.id} job={job} />
            {index !== data.length - 1 && <HStack fullWidth border />}
          </Fragment>
        ))}
      </VStack>
    </VStack>
  );
}

function DataSourceHomePage() {
  return (
    <DashboardPageLayout title="Source Info">
      <DashboardPageSection>
        <DashboardJobList />

        <DataSourceInfo />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default DataSourceHomePage;
