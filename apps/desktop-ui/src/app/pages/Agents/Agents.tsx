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
  type AgentState,
  useAgentsServiceListAgents,
} from '@letta-cloud/sdk-core';
import type { ColumnDef } from '@tanstack/react-table';
import React, { useEffect, useMemo, useState } from 'react';
import { useDateFormatter } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { CreateLocalAgentDialog } from './CreateLocalAgentDialog/CreateLocalAgentDialog';
import { useServerStatus } from '../../hooks/useServerStatus/useServerStatus';
import { ImportAgentsDialog } from '@letta-cloud/ui-ade-components';

const LIMIT = 10;

export function Agents() {
  const t = useTranslations('Agents');
  const { formatDateAndTime } = useDateFormatter();
  const status = useServerStatus();

  const { data, isError } = useAgentsServiceListAgents(
    { limit: 1000 },
    undefined,
    {
      enabled: status,
      refetchInterval: 2500,
    },
  );

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
          <Link to={`/dashboard/agents/${row.original?.id}`}>
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
      <VStack fullWidth fullHeight paddingX="small" paddingTop="small">
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
      </VStack>
    </DesktopPageLayout>
  );
}
