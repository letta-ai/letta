'use client';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import type { AgentState } from '@letta-web/letta-agents-api';
import { useAgentsServiceListAgents } from '@letta-web/letta-agents-api';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

const LIMIT = 10;

function LocalProjectPage() {
  const t = useTranslations('local-project/page');
  const { data } = useAgentsServiceListAgents();

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(LIMIT);

  const pagedData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.slice(offset, offset + limit);
  }, [data, offset, limit]);

  const hasNextPage = useMemo(() => {
    if (!data) {
      return false;
    }

    return data.length > offset + LIMIT;
  }, [data, offset]);

  const columns: Array<ColumnDef<AgentState>> = useMemo(
    () => [
      {
        header: t('table.columns.id'),
        accessorKey: 'id',
      },
      {
        header: t('table.columns.name'),
        accessorKey: 'name',
      },
      {
        header: t('table.columns.actions'),
        id: 'actions',
        cell: ({ row }) => (
          <Button
            size="small"
            href={`/local-project/agents/${row.original.id}`}
            color="secondary"
            label={t('table.openInADE')}
          />
        ),
      },
    ],
    [t]
  );

  return (
    <DashboardPageLayout title={t('title')}>
      <DashboardPageSection>
        <DataTable
          autofitHeight
          offset={offset}
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

export default LocalProjectPage;
