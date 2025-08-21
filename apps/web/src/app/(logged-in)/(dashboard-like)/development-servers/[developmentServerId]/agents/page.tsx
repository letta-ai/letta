'use client';
import {
  Button,
  Card,
  CopyButton,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
  MiddleTruncate,
  PlusIcon,
  RawInput,
  Typography,
  VStack,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import {
  AgentsService,
  UseAgentsServiceListAgentsKeyFn,
} from '@letta-cloud/sdk-core';
import type { AgentState, ListAgentsResponse } from '@letta-cloud/sdk-core';
import React, { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatters } from '@letta-cloud/utils-client';
import { useCurrentDevelopmentServerConfig } from '@letta-cloud/utils-client';
import { ConnectToLocalServerCommand } from '$web/client/components/ConnectToLocalServerCommand/ConnectToLocalServerCommand';
import { UpdateDevelopmentServerDetailsDialog } from '../../shared/UpdateDevelopmentServerDetailsDialog/UpdateDevelopmentServerDetailsDialog';
import { useCurrentUser } from '$web/client/hooks';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import CreateAgentDialog from '../components/CreateAgentDialog/CreateAgentDialog';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import type { InfiniteData } from '@tanstack/query-core';
import { ImportAgentsDialog } from '@letta-cloud/ui-ade-components';

const LIMIT = 10;

interface ErrorViewProps {
  onRetry: VoidFunction;
}

function ErrorView(props: ErrorViewProps) {
  const { onRetry } = props;
  const t = useTranslations('development-servers/page');
  const currentDevelopmentServerConfig = useCurrentDevelopmentServerConfig();

  const isLocal = useMemo(() => {
    return currentDevelopmentServerConfig?.id === 'local';
  }, [currentDevelopmentServerConfig]);

  return (
    <VStack paddingTop="xxlarge" align="center">
      <Card>
        <VStack paddingY="xxlarge" align="center" width="contained">
          <WarningIcon size="xxlarge" />
          <Typography variant="heading3">{t('ErrorView.title')}</Typography>
          <Typography>
            {isLocal
              ? t('ErrorView.localConnection')
              : t('ErrorView.description')}
          </Typography>
          {isLocal ? (
            <VStack>
              <Typography>{t('ErrorView.runTheServer')}</Typography>
              <ConnectToLocalServerCommand />
            </VStack>
          ) : (
            <VStack>
              <Typography>{t('ErrorView.connection.title')}</Typography>
              <RawInput
                hideLabel
                label={t('ErrorView.connection.url.label')}
                fullWidth
                onChange={() => {
                  return false;
                }}
                value={currentDevelopmentServerConfig?.url || ''}
              />
              <RawInput
                hideLabel
                showVisibilityControls
                onChange={() => {
                  return false;
                }}
                label={t('ErrorView.connection.password.label')}
                fullWidth
                value={currentDevelopmentServerConfig?.password || ''}
              />
            </VStack>
          )}
          <HStack paddingTop="small">
            <Button
              onClick={onRetry}
              color="primary"
              label={t('ErrorView.retry')}
            />
            {currentDevelopmentServerConfig && !isLocal && (
              <UpdateDevelopmentServerDetailsDialog
                trigger={
                  <Button
                    color="secondary"
                    label={t('ErrorView.updateConnectionDetails')}
                  />
                }
                name={currentDevelopmentServerConfig.name}
                password={currentDevelopmentServerConfig.password || ''}
                url={currentDevelopmentServerConfig.url}
                id={currentDevelopmentServerConfig.id}
              />
            )}
          </HStack>
        </VStack>
      </Card>
    </VStack>
  );
}

function LocalProjectPage() {
  const t = useTranslations('development-servers/page');
  const currentDevelopmentServerConfig = useCurrentDevelopmentServerConfig();

  const [search, setSearch] = useState<string>('');

  const [page, setPage] = useState<number>(0);
  const [limit, setLimit] = useState(LIMIT);

  const [debouncedSearch] = useDebouncedValue(search, 500);
  const { data, refetch, isFetchingNextPage, isError, fetchNextPage } =
    useInfiniteQuery<
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

  const { formatDateAndTime, formatSmallDuration } = useFormatters();
  const user = useCurrentUser();

  const columns: Array<ColumnDef<AgentState>> = useMemo(
    () => [
      {
        header: t('table.columns.name'),
        accessorKey: 'name',
      },
      {
        header: t('table.columns.id'),
        accessorKey: 'id',
        cell: ({ row }) => (
          <HStack align="center">
            <MiddleTruncate visibleStart={4} visibleEnd={4}>
              {row.original.id}
            </MiddleTruncate>
            <CopyButton
              copyButtonText={t('table.copyId')}
              color="tertiary"
              size="small"
              hideLabel
              textToCopy={row.original.id}
            />
          </HStack>
        ),
      },
      {
        header: t('table.columns.createdAt'),
        accessorKey: 'created_at',
        cell: ({ row }) => {
          return formatDateAndTime(row.original?.created_at || '');
        },
      },
      {
        id: 'lastRunCompletion',
        header: t('table.columns.lastRunCompletion'),
        cell: ({ row }) => {
          if (
            !row.original?.last_run_completion ||
            Array.isArray(row.original?.last_run_completion)
          ) {
            return '-';
          }
          return formatDateAndTime(row.original.last_run_completion);
        },
      },
      {
        id: 'lastRunDuration',
        header: t('table.columns.lastRunDuration'),
        cell: ({ row }) => {
          if (
            !row.original?.last_run_duration_ms ||
            Array.isArray(row.original?.last_run_duration_ms)
          ) {
            return '-';
          }
          const durationNanoseconds =
            row.original.last_run_duration_ms * 1000 * 1000;
          return formatSmallDuration(durationNanoseconds);
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
          <Button
            onClick={() => {
              trackClientSideEvent(AnalyticsEvent.LOCAL_AGENT_VISITED, {
                user_id: user?.id || '',
              });
            }}
            href={`/development-servers/${
              currentDevelopmentServerConfig?.id || 'local'
            }/agents/${row.original.id}`}
            color="secondary"
            label={t('table.openInADE')}
          />
        ),
      },
    ],
    [
      t,
      formatDateAndTime,
      formatSmallDuration,
      currentDevelopmentServerConfig?.id,
      user?.id,
    ],
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
    <DashboardPageLayout
      subtitle={t('description')}
      title={currentDevelopmentServerConfig?.name || ''}
      actions={
        <HStack>
          <ImportAgentsDialog
            trigger={<Button color="tertiary" label={t('importAgent')} />}
          />
          <CreateAgentDialog
            trigger={
              <Button
                preIcon={<PlusIcon />}
                color="primary"
                label={t('createAgent')}
              />
            }
          />
        </HStack>
      }
      encapsulatedFullHeight
    >
      <DashboardPageSection
        fullHeight
        searchPlaceholder={t('searchInput.placeholder')}
      >
        {isError ? (
          <ErrorView
            onRetry={() => {
              void refetch();
            }}
          />
        ) : (
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
        )}
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default LocalProjectPage;
