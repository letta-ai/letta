'use client';
import { useTranslations } from '@letta-cloud/translations';
import type { ColumnDef } from '@tanstack/react-table';
import {
  IdentitiesService,
  UseIdentitiesServiceListIdentitiesKeyFn,
} from '@letta-cloud/letta-agents-api';
import type {
  Identity,
  IdentityType,
  ListIdentitiesResponse,
} from '@letta-cloud/letta-agents-api';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
} from '@letta-cloud/component-library';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { useDebouncedValue } from '@mantine/hooks';

interface IdentityTypeCellProps {
  type: IdentityType;
}

function useIdentityTypeToTranslationMap() {
  const t = useTranslations('IdentitiesTable');

  return {
    org: t('identityTypes.org'),
    user: t('identityTypes.user'),
    other: t('identityTypes.other'),
  };
}

function IdentityTypeCell(props: IdentityTypeCellProps) {
  const identityTypeToTranslationMap = useIdentityTypeToTranslationMap();

  return <Badge content={identityTypeToTranslationMap[props.type]} />;
}

export function IdentitiesTable() {
  const t = useTranslations('IdentitiesTable');

  const [search, setSearch] = useState<string>('');

  const [page, setPage] = useState<number>(0);
  const [limit, setLimit] = useState(0);

  const [debouncedSearch] = useDebouncedValue(search, 500);

  const { data, isFetchingNextPage, isError, fetchNextPage } = useInfiniteQuery<
    ListIdentitiesResponse,
    unknown,
    InfiniteData<ListIdentitiesResponse>,
    unknown[],
    { after?: string | null }
  >({
    queryKey: [
      'infinite',
      ...UseIdentitiesServiceListIdentitiesKeyFn({
        name: debouncedSearch,
        limit: limit + 1,
      }),
    ],
    queryFn: ({ pageParam }) => {
      return IdentitiesService.listIdentities({
        name: debouncedSearch,
        limit: limit + 1,
        after: pageParam?.after,
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
    enabled: !!limit,
  });

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

  const columns: Array<ColumnDef<Identity>> = useMemo(() => {
    return [
      {
        id: 'name',
        header: t('columns.name'),
        accessorKey: 'identifier_key',
      },
      {
        id: 'type',
        header: t('columns.type'),
        accessorKey: 'identity_type',
        cell: ({ row }) => (
          <IdentityTypeCell type={row.original.identity_type} />
        ),
      },
      {
        id: 'identifierKey',
        header: t('columns.identifierKey'),
        accessorKey: 'identifier_key',
      },
    ];
  }, [t]);

  return (
    <DashboardPageLayout
      subtitle={t('description')}
      title={t('title')}
      actions={<HStack></HStack>}
      encapsulatedFullHeight
    >
      <DashboardPageSection
        fullHeight
        searchPlaceholder={t('searchInput.placeholder')}
      >
        <DataTable
          autofitHeight
          onSetPage={setPage}
          page={page}
          searchValue={search}
          errorMessage={isError ? t('table.error') : undefined}
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
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}
