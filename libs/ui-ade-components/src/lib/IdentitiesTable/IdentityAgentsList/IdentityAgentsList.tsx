import { useTranslations } from '@letta-cloud/translations';
import React, { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  AgentsService,
  UseAgentsServiceListAgentsKeyFn,
} from '@letta-cloud/sdk-core';
import type {
  AgentState,
  Identity,
  ListAgentsResponse,
} from '@letta-cloud/sdk-core';
import type { InfiniteData } from '@tanstack/query-core';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  CopyButton,
  DataTable,
  HStack,
  MiddleTruncate,
  Typography,
} from '@letta-cloud/ui-component-library';

interface AgentsListProps {
  identity: Identity;
}

export function IdentityAgentsList(props: AgentsListProps) {
  const t = useTranslations('IdentityAgentsList');
  const { identity } = props;
  const [search, setSearch] = useState<string>('');

  const [page, setPage] = useState<number>(0);
  const limit = 5;

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
        identityId: identity.id || '',
        queryText: debouncedSearch,
        limit: limit + 1,
      }),
    ],
    queryFn: ({ pageParam }) => {
      return AgentsService.listAgents({
        queryText: debouncedSearch,
        limit: limit + 1,
        after: pageParam?.after,
        identityId: identity.id || '',
      });
    },
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

  const filteredData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.pages?.[page]?.slice(0, limit) || [];
  }, [data, page, limit]);

  const isLoadingPage = useMemo(() => {
    if (!data) {
      return true;
    }

    if (isFetchingNextPage && !data.pages[page]) {
      return true;
    }

    return false;
  }, [data, isFetchingNextPage, page]);

  const rootUrl = useMemo(() => {
    return window.location.pathname.split('/identities')[0];
  }, []);

  const columns: Array<ColumnDef<AgentState>> = useMemo(() => {
    return [
      {
        id: 'id',
        header: t('columns.id'),
        accessorFn: (row) => row.id,
        cell: ({ row }) => {
          return (
            <HStack align="center">
              <MiddleTruncate visibleStart={4} visibleEnd={4}>
                {row.original.id || ''}
              </MiddleTruncate>
              <CopyButton
                copyButtonText={t('columns.copyId')}
                color="tertiary"
                size="small"
                hideLabel
                textToCopy={row.original.id || ''}
              />
            </HStack>
          );
        },
      },
      {
        id: 'name',
        header: t('columns.name'),
        meta: {
          style: {
            width: '50%',
          },
        },
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <HStack align="center">
            <Typography>{row.original.name}</Typography>
          </HStack>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          return (
            <Button
              label={t('columns.view')}
              color="tertiary"
              target="_blank"
              size="small"
              href={`${rootUrl}/agents/${row.original.id}`}
            />
          );
        },
      },
    ];
  }, [t, rootUrl]);

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (page === data.pages.length) {
      void fetchNextPage();
    }
  }, [page, data, fetchNextPage]);

  const hasNextPage = useMemo(() => {
    if (!data?.pages?.[page]) {
      return false;
    }

    return data.pages[page].length > limit;
  }, [data, page, limit]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  return (
    <DataTable
      onSetPage={setPage}
      page={page}
      searchValue={search}
      errorMessage={isError ? t('error') : undefined}
      onSearch={!isError ? setSearch : undefined}
      limit={limit}
      hasNextPage={hasNextPage}
      showPagination
      columns={columns}
      data={filteredData}
      isLoading={isLoadingPage}
      loadingText={t('loading')}
      noResultsText={t('noResults')}
    />
  );
}
