'use client';
import {
  Button,
  Card,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
  PlusIcon,
  RawInput,
  Typography,
  VStack,
  WarningIcon,
} from '@letta-web/component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { AgentState } from '@letta-web/letta-agents-api';
import { useAgentsServiceListAgents } from '@letta-web/letta-agents-api';
import React, { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useDateFormatter } from '@letta-web/helpful-client-utils';
import { useCurrentDevelopmentServerConfig } from '@letta-web/helpful-client-utils';
import { ConnectToLocalServerCommand } from '$web/client/components/ConnectToLocalServerCommand/ConnectToLocalServerCommand';
import { UpdateDevelopmentServerDetailsDialog } from '../../shared/UpdateDevelopmentServerDetailsDialog/UpdateDevelopmentServerDetailsDialog';
import { useCurrentUser } from '$web/client/hooks';
import { trackClientSideEvent } from '@letta-web/analytics/client';
import { AnalyticsEvent } from '@letta-web/analytics';
import CreateAgentDialog from '../components/CreateAgentDialog/CreateAgentDialog';

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
              color="secondary"
              label={t('ErrorView.retry')}
            />
            {currentDevelopmentServerConfig && !isLocal && (
              <UpdateDevelopmentServerDetailsDialog
                trigger={
                  <Button
                    color="tertiary"
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
  const { data, refetch, isError } = useAgentsServiceListAgents();
  const currentDevelopmentServerConfig = useCurrentDevelopmentServerConfig();

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

  const { formatDateAndTime } = useDateFormatter();
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
          <Button
            onClick={() => {
              trackClientSideEvent(AnalyticsEvent.LOCAL_AGENT_VISITED, {
                userId: user?.id || '',
              });
            }}
            href={`/development-servers/${
              currentDevelopmentServerConfig?.id || 'local'
            }/agents/${row.original.id}`}
            color="tertiary"
            label={t('table.openInADE')}
          />
        ),
      },
    ],
    [t, formatDateAndTime, currentDevelopmentServerConfig?.id, user?.id],
  );

  return (
    <DashboardPageLayout
      subtitle={t('description')}
      title={currentDevelopmentServerConfig?.name || ''}
      actions={
        <HStack>
          <CreateAgentDialog
            trigger={
              <Button
                preIcon={<PlusIcon />}
                color="secondary"
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
        )}
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default LocalProjectPage;
