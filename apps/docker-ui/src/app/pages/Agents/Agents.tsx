import { Link } from 'react-router-dom';
import {
  Button,
  DataTable,
  DesktopPageLayout,
  HStack,
  LettaInvaderIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import {
  AgentsService,
  type AgentState,
  type ListAgentsResponse,
  UseAgentsServiceListAgentsKeyFn,
} from '@letta-cloud/sdk-core';
import type { ColumnDef } from '@tanstack/react-table';
import React, { useEffect, useMemo, useState } from 'react';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { CreateLocalAgentDialog } from './CreateLocalAgentDialog/CreateLocalAgentDialog';
import { ImportAgentsDialog } from '@letta-cloud/ui-ade-components';
import { useDebouncedValue } from '@mantine/hooks';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';

export function Agents() {
  const t = useTranslations('Agents');
  const { formatDateAndTime } = useFormatters();

  const [search, setSearch] = useState<string>('');

  const [page, setPage] = useState<number>(0);
  const [limit, setLimit] = useState(10);

  const [debouncedSearch] = useDebouncedValue(search, 500);
  const { data, isFetchingNextPage, isError, fetchNextPage } = useInfiniteQuery<
    ListAgentsResponse,
    unknown,
    InfiniteData<ListAgentsResponse>,
    unknown[],
    { after?: string | null }
  >({
    queryKey: [
      'infinite',
      ...UseAgentsServiceListAgentsKeyFn({
        queryText: debouncedSearch,
        limit: limit + 1,
      }),
    ],
    queryFn: ({ pageParam }) => {
      return AgentsService.listAgents({
        queryText: debouncedSearch,
        limit: limit + 1,
        after: pageParam?.after,
      });
    },
    enabled: limit > 0,
    initialPageParam: { after: null },
    getNextPageParam: (lastPage) => {
      if (lastPage.length > limit) {
        return {
          after: lastPage[lastPage.length - 2].id,
        };
      }

      return undefined;
    },
  });

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (page === data.pages.length) {
      void fetchNextPage();
    }
  }, [page, data, fetchNextPage]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const isLoadingPage = useMemo(() => {
    if (!data) {
      return true;
    }

    if (isFetchingNextPage && !data.pages[page]) {
      return true;
    }

    return false;
  }, [data, isFetchingNextPage, page]);

  const hasNextPage = useMemo(() => {
    if (!data?.pages?.[page]) {
      return false;
    }

    return data.pages[page].length > limit;
  }, [data, page, limit]);

  const filteredData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.pages?.[page]?.slice(0, limit) || [];
  }, [data, page, limit]);

  const columns: Array<ColumnDef<AgentState>> = useMemo(
    () => [
      {
        header: t('table.columns.name'),
        accessorKey: 'name',
      },
      {
        header: t('table.columns.id'),
        accessorKey: 'id',
      },
      {
        header: t('table.columns.createdAt'),
        accessorKey: 'created_at',
        cell: ({ row }) => {
          return formatDateAndTime(row.original?.created_at || '');
        },
      },
      {
        header: '',
        id: 'actions',
        meta: {
          style: {
            columnAlign: 'right',
            sticky: 'right',
          },
        },
        cell: ({ row }) => (
          <Link to={`/agents/${row.original?.id}`}>
            <Button color="secondary" label={t('table.openInADE')} />
          </Link>
        ),
      },
    ],
    [t, formatDateAndTime],
  );

  return (
    <DesktopPageLayout
      icon={<LettaInvaderIcon />}
      subtitle={t('subtitle')}
      actions={
        <HStack>
          <ImportAgentsDialog
            trigger={
              <Button size="small" color="tertiary" label={t('importAgent')} />
            }
          />
          <CreateLocalAgentDialog
            trigger={
              <Button size="small" color="primary" label={t('createAgent')} />
            }
          />
        </HStack>
      }
      title={t('title')}
    >
      <VStack overflowY="auto" fullHeight paddingX="small" paddingTop="small">
        <div className="min-h-[500px] h-full">
          <DataTable
            autofitHeight
            onSetPage={setPage}
            page={page}
            searchValue={search}
            onSearch={!isError ? setSearch : undefined}
            onLimitChange={setLimit}
            limit={limit}
            hasNextPage={hasNextPage}
            showPagination
            columns={columns}
            data={filteredData}
            isLoading={isLoadingPage}
            loadingText={t('table.loading')}
            noResultsText={t('table.noResults')}
          />
        </div>
      </VStack>
    </DesktopPageLayout>
  );
}
