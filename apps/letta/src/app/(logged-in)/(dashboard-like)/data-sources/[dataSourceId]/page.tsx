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
} from '@letta-web/component-library';
import type { Job } from '@letta-web/letta-agents-api';
import {
  useJobsServiceListActiveJobs,
  useSourcesServiceGetSource,
} from '@letta-web/letta-agents-api';
import { useCurrentDataSourceId } from './hooks';
import type { ColumnDef } from '@tanstack/react-table';
import { useCurrentUser } from '$letta/client/hooks';

// const dataSourceColumns: Array<ColumnDef<Document>> = [
//   {
//     header: 'File Name',
//     accessorFn: (row) => get(row.metadata_, 'filename', ''),
//   },
//   {
//     header: 'Size',
//     accessorFn: (row) => row.text.length,
//   },
//   {
//     header: '',
//     id: 'actions',
//     accessorKey: 'id',
//   },
// ];

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
  const dataSourceId = useCurrentDataSourceId();
  const { data } = useSourcesServiceGetSource({
    sourceId: dataSourceId,
  });

  const tableData = useMemo(() => {
    if (!data?.embedding_config) {
      return [];
    }

    return Object.entries({
      ...data.embedding_config,
      ...data.metadata_,
    })
      .map(([key, value]) => ({
        name: key,
        detail: typeof value === 'string' ? value : JSON.stringify(value),
      }))
      .filter((row) => row.detail !== undefined);
  }, [data]);

  return <DataTable columns={columns} data={tableData} />;
}

// function DataSourceList() {
//   const dataSourceId = useCurrentDataSourceId();
//   const { data } = useSourcesServiceListSourceDocuments({
//     sourceId: dataSourceId,
//   });
//
//   return (
//     <DataTable
//       columns={dataSourceColumns}
//       data={data || []}
//       isLoading={!data}
//       noResultsText="There are no files in this datasource"
//     />
//   );
// }

interface JobItemProps {
  job: Job;
}

function JobItem(props: JobItemProps) {
  const { job } = props;
  const { metadata_ } = job;

  const contentName = useMemo(() => {
    const filename = metadata_?.filename;

    if (typeof filename === 'string') {
      return `Processing ${filename}`;
    }

    return 'Processing unknown file';
  }, [metadata_?.filename]);

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
  const { id: userId } = useCurrentUser();
  const { data } = useJobsServiceListActiveJobs({ userId }, undefined, {
    refetchInterval: 5000,
  });

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
