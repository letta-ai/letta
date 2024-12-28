import { Link } from 'react-router-dom';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
} from '@letta-web/component-library';
import { useTranslation } from 'react-i18next';
import {
  type AgentState,
  useAgentsServiceListAgents,
} from '@letta-web/letta-agents-api';
import type { ColumnDef } from '@tanstack/react-table';
import React, { useEffect, useMemo, useState } from 'react';
import { useDateFormatter } from '@letta-web/helpful-client-utils';

const LIMIT = 10;

export function Homepage() {
  const { t } = useTranslation('Homepage');
  const { formatDateAndTime } = useDateFormatter();

  const { data, isError } = useAgentsServiceListAgents();

  const [search, setSearch] = useState<string>('');

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(LIMIT);

  useEffect(() => {
    setOffset(0);
  }, [search]);

  const filteredData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data?.filter(({ name }) =>
      name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [data, search]);

  const pagedData = useMemo(() => {
    return filteredData.slice(offset, offset + limit);
  }, [filteredData, offset, limit]);

  const hasNextPage = useMemo(() => {
    if (!data) {
      return false;
    }

    return data.length > offset + LIMIT;
  }, [data, offset]);
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
            <Button color="tertiary" label={t('table.openInADE')} />
          </Link>
        ),
      },
    ],
    [t, formatDateAndTime],
  );

  return (
    <DashboardPageLayout fullHeight title={t('title')}>
      <DashboardPageSection fullHeight>
        <DataTable
          autofitHeight
          offset={offset}
          searchValue={search}
          onSearch={!isError ? setSearch : undefined}
          onLimitChange={setLimit}
          limit={limit}
          hasNextPage={hasNextPage}
          showPagination
          onSetOffset={setOffset}
          columns={columns}
          data={pagedData}
          isLoading={!data}
          loadingText={t('table.loading')}
          noResultsText={t('table.noResults')}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}
