'use client';
import { useCurrentDataSourceId } from '../hooks';
import type { Job } from '@letta-cloud/sdk-core';
import { useJobsServiceListJobs } from '@letta-cloud/sdk-core';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useFormatters } from '@letta-cloud/utils-client';
import {
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  JobStatusBadge,
  Typography,
} from '@letta-cloud/ui-component-library';

export default function JobsPage() {
  const dataSourceId = useCurrentDataSourceId();

  const [limit, setLimit] = useState(0);
  const [offset, setOffset] = useState(0);

  const { data } = useJobsServiceListJobs(
    {
      sourceId: dataSourceId,
    },
    undefined,
    {
      refetchInterval: 5000,
      enabled: limit > 0,
    },
  );

  const { formatDateAndTime } = useFormatters();

  const t = useTranslations('datasources/jobs');

  const columns: Array<ColumnDef<Job>> = useMemo(
    () => [
      {
        accessorKey: 'status',
        header: t('table.status'),
        meta: {
          style: {
            width: '100px',
          },
        },
        cell: ({ row }) => {
          return <JobStatusBadge status={row.original.status || 'pending'} />;
        },
      },
      {
        meta: {
          style: {
            width: '150px',
          },
        },
        accessorKey: 'created_at',
        header: t('table.startedAt'),
        cell: ({ row }) =>
          row.original.created_at && (
            <Typography>
              {formatDateAndTime(row.original.created_at)}
            </Typography>
          ),
      },
      {
        meta: {
          style: {
            width: '150px',
          },
        },
        accessorKey: 'completed_at',
        header: t('table.completedAt'),
        cell: ({ row }) =>
          row.original.completed_at && (
            <Typography>
              {formatDateAndTime(row.original.completed_at)}
            </Typography>
          ),
      },
      {
        accessorKey: 'id',
        header: t('table.id'),
      },
    ],
    [formatDateAndTime, t],
  );

  const rows = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.slice(offset * limit, offset * limit + limit);
  }, [data, limit, offset]);

  return (
    <DashboardPageLayout
      title={t('title')}
      encapsulatedFullHeight
      subtitle={t('subtitle')}
    >
      <DashboardPageSection fullHeight>
        <DataTable
          onSetOffset={setOffset}
          offset={offset}
          onLimitChange={setLimit}
          limit={limit}
          autofitHeight
          columns={columns}
          data={rows}
          isLoading={!data}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}
