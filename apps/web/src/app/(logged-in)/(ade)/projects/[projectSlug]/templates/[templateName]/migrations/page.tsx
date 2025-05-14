'use client';
import { useTranslations } from '@letta-cloud/translations';
import { ADEPage } from '$web/client/components/ADEPage/ADEPage';
import {
  Badge,
  CopyButton,
  DataTable,
  HStack,
  MiddleTruncate,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useEffect, useMemo, useState } from 'react';
import type { MigrationDetail } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatters } from '@letta-cloud/utils-client';
import { MigrationStatus } from '@letta-cloud/sdk-cloud-api';

interface StatusBadgeProps {
  status: MigrationStatus;
}

function StatusBadge(props: StatusBadgeProps) {
  const { status } = props;
  const t = useTranslations('pages/migrations');
  const statusText = useMemo(() => {
    switch (status) {
      case MigrationStatus.RUNNING:
        return t('MigrationsTable.status.running');
      case MigrationStatus.COMPLETED:
        return t('MigrationsTable.status.completed');
      case MigrationStatus.FAILED:
        return t('MigrationsTable.status.failed');
      case MigrationStatus.CANCELED:
        return t('MigrationsTable.status.cancelled');
      default:
        return t('MigrationsTable.status.unknown');
    }
  }, [status, t]);

  const statusVariant = useMemo(() => {
    switch (status) {
      case MigrationStatus.RUNNING:
        return 'info';
      case MigrationStatus.COMPLETED:
        return 'success';
      case MigrationStatus.FAILED:
        return 'destructive';
      case MigrationStatus.CANCELED:
        return 'warning';
      default:
        return 'default';
    }
  }, [status]);

  return <Badge content={statusText} variant={statusVariant} />;
}

function MigrationsTable() {
  const { templateName } = useCurrentAgentMetaData();

  const [limit, setLimit] = useState(0);
  const t = useTranslations('pages/migrations');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    webApi.agentTemplates.listAgentMigrations.useInfiniteQuery({
      queryKey: webApiQueryKeys.agentTemplates.listAgentMigrationsWithSearch({
        templateName: templateName || '',
        limit: Math.max(2, limit),
      }),
      queryData: ({ pageParam }) => ({
        query: {
          limit: Math.max(2, limit),
          templateName: templateName || '',
          ...(pageParam?.cursor ? { cursor: pageParam.cursor } : {}),
        },
      }),
      refetchInterval: 5000,
      initialPageParam: { cursor: '' },
      getNextPageParam: (lastPage) => {
        if (lastPage?.body.nextPage) {
          return {
            cursor: lastPage.body.nextPage,
          };
        }

        return undefined;
      },
      enabled: !!templateName && limit > 0,
    });

  const [page, setPage] = useState(0);

  const { formatDateAndTime } = useFormatters();

  const columns: Array<ColumnDef<MigrationDetail>> = useMemo(
    () => [
      {
        meta: {
          style: {
            width: '50px',
          },
        },
        accessorKey: 'workflowId',
        header: t('MigrationsTable.columns.workflowId'),
        cell: ({ row }) => (
          <HStack align="center">
            <Typography as="span">
              <MiddleTruncate visibleEnd={5} visibleStart={1}>
                {row.original.workflowId}
              </MiddleTruncate>
            </Typography>
            <CopyButton
              size="small"
              textToCopy={row.original.workflowId}
              hideLabel
            />
          </HStack>
        ),
      },
      {
        meta: {
          style: {
            width: '80px',
          },
        },
        accessorKey: 'status',
        header: t('MigrationsTable.columns.status'),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'templateVersion',
        header: t('MigrationsTable.columns.templateVersion'),
      },

      {
        accessorKey: 'startedAt',
        header: t('MigrationsTable.columns.startedAt'),
        cell: ({ row }) => formatDateAndTime(row.original.startedAt),
      },
      {
        accessorKey: 'completedAt',
        header: t('MigrationsTable.columns.completedAt'),
        cell: ({ row }) =>
          row.original.completedAt
            ? formatDateAndTime(row.original.completedAt)
            : null,
      },
    ],
    [formatDateAndTime, t],
  );

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (page === data.pages.length) {
      void fetchNextPage();
    }
  }, [page, data, fetchNextPage]);

  const currentPage = useMemo(
    () => data?.pages[page]?.body.migrations || [],
    [data, page],
  );

  const isLoadingPage = useMemo(() => {
    if (!data) {
      return true;
    }

    if (isFetchingNextPage && !data.pages[page]) {
      return true;
    }

    return false;
  }, [data, isFetchingNextPage, page]);

  return (
    <VStack paddingX paddingTop="small" fullHeight fullWidth>
      <DataTable
        columns={columns}
        data={currentPage}
        page={page}
        autofitHeight
        onLimitChange={setLimit}
        onSetPage={setPage}
        loadingText={t('MigrationsTable.loading')}
        noResultsText={t('MigrationsTable.noMigrations')}
        isLoading={isLoadingPage}
        hasNextPage={hasNextPage}
        showPagination
        limit={limit}
      />
    </VStack>
  );
}

export default function MigrationsPage() {
  const t = useTranslations('pages/migrations');

  return (
    <ADEPage>
      <VStack gap={false} fullHeight fullWidth color="background-grey">
        <VStack paddingX paddingTop="small">
          <Typography uppercase variant="body3" bold>
            {t('title')}
          </Typography>
        </VStack>
        <MigrationsTable />
      </VStack>
    </ADEPage>
  );
}
