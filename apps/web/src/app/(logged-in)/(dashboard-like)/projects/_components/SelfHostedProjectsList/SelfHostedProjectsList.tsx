'use client';
import React, { useMemo } from 'react';
import {
  Button,
  ChevronRightIcon, CogIcon,
  CopyButton,
  DataTable,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  HStack,
  TrashIcon,
  Typography,
  VStack
} from '@letta-cloud/ui-component-library';
import { useDebouncedValue } from '@mantine/hooks';
import { useTranslations } from '@letta-cloud/translations';
import { type DevelopmentServerConfig } from '@letta-cloud/utils-client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { SelfHostedStatusIndicator } from '$web/client/components/SelfHostedServerStatusIndicator/SelfHostedStatusIndicator';
import { DeleteDevelopmentServerDialog } from '../../../development-servers/shared/DeleteDevelopmentServerDialog/DeleteDevelopmentServerDialog';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SelfHostedProjectsListProps {
  search: string;
}

interface DevelopmentServerActionsProps {
  config: DevelopmentServerConfig;
}

function DevelopmentServerActions(props: DevelopmentServerActionsProps) {
  const { config } = props;
  const t = useTranslations(
    'projects/page/SelfHostedProjectsList.DevelopmentServerActions',
  );

  // Don't show actions for local server
  if (config.id === 'local') {
    return null;
  }

  return (
    <DropdownMenu
      trigger={
        <Button
          color="tertiary"
          label={t('trigger')}
          preIcon={<DotsHorizontalIcon />}
          size="small"
          hideLabel
        />
      }
      align="end"
      triggerAsChild
    >
      <DeleteDevelopmentServerDialog
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            label={t('delete')}
            preIcon={<TrashIcon />}
          />
        }
        developmentServerId={config.id}
        developmentServerName={config.name}
      />
      <DropdownMenuItem
        href={`/development-servers/${config.id}/settings`}
        label={t('settings')}
        preIcon={<CogIcon />}
      />
    </DropdownMenu>
  );
}


export function SelfHostedProjectsList(props: SelfHostedProjectsListProps) {
  const { search } = props;
  const t = useTranslations('projects/page/SelfHostedProjectsList');
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const [limit, setLimit] = React.useState(10);

  const [offset, setOffset] = React.useState(0);

  const { data, isError, isLoading } =
    webApi.developmentServers.getDevelopmentServers.useQuery({
      queryKey:
        webApiQueryKeys.developmentServers.getDevelopmentServersWithSearch({
          search: debouncedSearch,
          limit,
          offset,
        }),
      queryData: {
        query: {
          search: debouncedSearch,
          offset,
          limit: limit,
        },
      },
      enabled: !!limit,
    });

  // Prepare table data including local server
  const tableData = useMemo(() => {
    return  data?.body?.developmentServers || [];

  }, [data]);

  const router = useRouter();

  // Define table columns
  const columns: Array<ColumnDef<DevelopmentServerConfig>> = useMemo(() => {
    return [
      {
        id: 'name',
        header: t('columns.name'),
        cell: ({ row }) => (
          <Link href={`/development-servers/${row.original.id}`}>
            <HStack align="center">
              <SelfHostedStatusIndicator config={row.original} />
              <Typography variant="body3" >
                {row.original.name}
              </Typography>
            </HStack>
          </Link>
        ),
      },
      {
        id: 'url',
        header: t('columns.url'),
        accessorFn: (row) => row.url,
        cell: ({ row }) => (
          <VStack>
            <HStack align="center">
              <Typography
                onClick={(e) => {
                  e.stopPropagation();
                }}
                variant="body3"
              >
                {row.original.url}
              </Typography>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <CopyButton hideLabel size="small" textToCopy={row.original.url || ''} />
              </div>
            </HStack>
          </VStack>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <HStack align="center" justify="end">
            <div onClick={(e) => e.stopPropagation()}>
              <DevelopmentServerActions config={row.original} />
            </div>
            <Button
              color="tertiary"
              size="small"
              preIcon={<ChevronRightIcon />}
              hideLabel
              label={t('goToDashboard')}
              href={`/development-servers/${row.original.id}/dashboard`}
            />
          </HStack>
        ),
        meta: {
          style: {
            columnAlign: 'right',
            width: '60px',
          },
        },
      },
    ];
  }, [t]);


  return (
    <DataTable

      minHeight={500}
      onRowClick={(row) => {
        router.push(`/development-servers/${row.id}/dashboard`);
      }}
      onLimitChange={setLimit}
      offset={offset}
      hasNextPage={data?.body?.hasMore || false}
      showPagination
      limit={limit}
      onSetOffset={setOffset}
      errorMessage={isError ? t('developmentServersList.error') : undefined}
      columns={columns}
      data={tableData}
      isLoading={isLoading}
      loadingText={t('developmentServersList.loading')}
      noResultsText={t('developmentServersList.noDevelopmentServers')}
    />
  );
}
