import { useMemo, useState } from 'react';
import {
  Badge,
  type BadgeProps,
  ComputerIcon,
  DatabaseIcon,
  DataTable,
  HStack,
  McpIcon,
  Typography,
  VStack,
  Link,
} from '@letta-cloud/ui-component-library';
import { useToolsServiceListMcpServers } from '@letta-cloud/sdk-core';
import type { LocalServerConfig, SSEServerConfig } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { AllToolsViewHeader } from '../AllToolsViewHeader/AllToolsViewHeader';
import type { ColumnDef } from '@tanstack/react-table';

type MCPServerResponse = LocalServerConfig | SSEServerConfig;

function MCPServerTable() {
  const [limit, setLimit] = useState(0);
  const [offset, setOffset] = useState(0);
  const t = useTranslations('ViewMCPServers');

  const { data: servers, isLoading, isError } = useToolsServiceListMcpServers();

  const serversAsList = useMemo(() => {
    return servers ? Object.values(servers) : [];
  }, [servers]);

  const paginatedServers = useMemo(() => {
    return serversAsList.slice(offset, offset + limit);
  }, [serversAsList, offset, limit]);

  const hasNextPage = useMemo(() => {
    return serversAsList.length > offset + limit;
  }, [serversAsList, offset, limit]);

  const columns: Array<ColumnDef<MCPServerResponse>> = useMemo(
    () => [
      {
        header: t('MCPServerTable.columns.type'),
        accessorKey: 'type',
        meta: {
          style: {
            width: '100px',
          },
        },
        cell: ({ row }) => {
          let message = t('MCPServerTable.types.local');
          let variant: BadgeProps['variant'] = 'info';
          let icon = <ComputerIcon />;

          if (row.original.type === 'sse') {
            message = t('MCPServerTable.types.remote');
            variant = 'success';
            icon = <DatabaseIcon />;
          }

          return (
            <Badge
              size="large"
              content={message}
              variant={variant}
              preIcon={icon}
            />
          );
        },
      },
      {
        header: t('MCPServerTable.columns.name'),
        accessorKey: 'server_name',
      },

      {
        header: t('MCPServerTable.columns.details'),
        accessorKey: 'type',
        cell: ({ row }) => {
          let message = '';
          if (row.original.type === 'sse') {
            message = (row.original as SSEServerConfig).server_url;
          } else if (row.original.type === 'local') {
            message = (row.original as LocalServerConfig).command;
          }

          return (
            <Typography variant="body3" font="mono">
              {message}
            </Typography>
          );
        },
      },
    ],
    [t],
  );

  return (
    <DataTable
      autofitHeight
      onLimitChange={setLimit}
      limit={limit}
      showPagination
      hasNextPage={hasNextPage}
      onSetOffset={setOffset}
      offset={offset}
      noResultsText={t('MCPServerTable.noResults')}
      isLoading={isLoading}
      errorMessage={isError ? t('MCPServerTable.error') : undefined}
      columns={columns}
      data={paginatedServers}
    />
  );
}

export function ViewMCPServers() {
  const t = useTranslations('ViewMCPServers');
  return (
    <VStack fullHeight overflow="hidden" fullWidth gap={false}>
      <AllToolsViewHeader />
      <VStack paddingX="xlarge" gap="large" flex fullHeight fullWidth>
        <VStack gap="large">
          <HStack align="end">
            <McpIcon size="xlarge" />
            <Typography variant="heading4">{t('title')}</Typography>
          </HStack>
          <HStack width="contained">
            <Typography>
              {t.rich('description', {
                link: (chunks) => (
                  <Link
                    href="https://docs.letta.com/guides/mcp/setup"
                    target="_blank"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </Typography>
          </HStack>
        </VStack>
        <MCPServerTable />
      </VStack>
    </VStack>
  );
}
