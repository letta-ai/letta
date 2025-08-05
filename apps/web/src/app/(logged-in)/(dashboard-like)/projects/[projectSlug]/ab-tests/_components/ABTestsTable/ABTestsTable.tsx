'use client';

import React, { useState, useMemo } from 'react';
import { webApi, webApiQueryKeys } from '$web/client';
import type { AbTestType } from '$web/web-api/contracts';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import {
  DataTable,
  Button,
  Typography,
  HStack,
} from '@letta-cloud/ui-component-library';
import { CreateABTest } from '../CreateABTest/CreateABTest';
import { ABTestActions } from '../ABTestActions/ABTestActions';

interface ABTestsTableProps {
  projectId: string;
  projectSlug: string;
}

export function ABTestsTable({ projectId, projectSlug }: ABTestsTableProps) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(10);
  const { formatDateAndTime } = useFormatters();
  const t = useTranslations('projects/ab-tests');

  const { data, isLoading, isError } = webApi.abTest.getAbTests.useQuery({
    queryKey: webApiQueryKeys.abTest.getAbTestsWithSearch(projectId, {
      offset,
      limit,
      search: search || undefined,
    }),
    queryData: {
      query: {
        offset,
        limit,
        search: search || undefined,
        projectId,
      },
    },
    enabled: !!projectId,
  });

  const abTests = data?.body?.abTests || [];
  const hasNextPage = data?.body?.hasNextPage || false;

  const columns: Array<ColumnDef<AbTestType>> = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: t('table.columns.name'),
        cell: ({ row }) => (
          <Typography variant="body2">{row.original.name}</Typography>
        ),
      },
      {
        accessorKey: 'description',
        header: t('table.columns.description'),
        cell: ({ row }) => (
          <Typography variant="body3">
            {row.original.description || '—'}
          </Typography>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: t('table.columns.updatedAt'),
        cell: ({ row }) => (
          <Typography variant="body3">
            {formatDateAndTime(new Date(row.original.updatedAt))}
          </Typography>
        ),
      },
      {
        id: 'actions',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: ({ row }) => (
          <HStack justify="end" fullWidth>
            <Button
              label={t('table.actions.view')}
              color="secondary"
              size="small"
              href={`/projects/${projectSlug}/ab-tests/${row.original.id}`}
            />
            <ABTestActions abTest={row.original} />
          </HStack>
        ),
      },
    ],
    [formatDateAndTime, t, projectSlug],
  );

  return (
    <DataTable
      columns={columns}
      data={abTests}
      isLoading={isLoading}
      errorMessage={isError ? t('table.errorMessage') : undefined}
      onSearch={setSearch}
      searchValue={search}
      onSetOffset={setOffset}
      offset={offset}
      limit={limit}
      hasNextPage={hasNextPage}
      showPagination
      autofitHeight
      onLimitChange={setLimit}
      loadingText={t('table.loading')}
      noResultsText={t('table.noResults')}
      noResultsAction={<CreateABTest />}
    />
  );
}
