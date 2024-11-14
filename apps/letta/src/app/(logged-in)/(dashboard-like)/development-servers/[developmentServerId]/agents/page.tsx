'use client';
import {
  Button,
  Card,
  CogIcon,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  FormField,
  FormProvider,
  HStack,
  Input,
  PlusIcon,
  RawInput,
  TrashIcon,
  Typography,
  useForm,
  VStack,
  WarningIcon,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import type { AgentState } from '@letta-web/letta-agents-api';
import { useResetAllLettaAgentsQueryKeys } from '@letta-web/letta-agents-api';
import { useAgentsServiceListAgents } from '@letta-web/letta-agents-api';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { CreateLocalAgentDialog } from '../../shared/CreateLocalAgentDialog/CreateLocalAgentDialog';
import { useDateFormatter } from '@letta-web/helpful-client-utils';
import { useCurrentDevelopmentServerConfig } from '../hooks/useCurrentDevelopmentServerConfig/useCurrentDevelopmentServerConfig';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';
import type { developmentServersContracts } from '$letta/web-api/development-servers/developmentServersContracts';
import { useRouter } from 'next/navigation';
import { ConnectToLocalServerCommand } from '$letta/client/components/ConnectToLocalServerCommand/ConnectToLocalServerCommand';

interface DeleteDevelopmentServerDialogProps {
  trigger: React.ReactNode;
  id: string;
}

function DeleteDevelopmentServerDialog(
  props: DeleteDevelopmentServerDialogProps
) {
  const t = useTranslations('development-servers/page');
  const { trigger, id } = props;
  const queryClient = useQueryClient();
  const { push } = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const { mutate, isPending, isSuccess, isError } =
    webApi.developmentServers.deleteDevelopmentServer.useMutation({
      onSuccess: () => {
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof developmentServersContracts.getDevelopmentServers,
            200
          >
        >(
          {
            queryKey: webApiQueryKeys.developmentServers.getDevelopmentServers,
            exact: true,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              body: {
                ...oldData.body,
                developmentServers: oldData.body.developmentServers.filter(
                  (server) => server.id !== id
                ),
              },
            };
          }
        );

        push('/development-servers/local/dashboard');
      },
    });

  const handleDelete = useCallback(() => {
    if (isPending || isSuccess) {
      return;
    }

    mutate({
      params: {
        developmentServerId: id,
      },
    });
  }, [isPending, isSuccess, mutate, id]);

  return (
    <Dialog
      trigger={trigger}
      isConfirmBusy={isPending || isSuccess}
      onConfirm={handleDelete}
      errorMessage={
        isError ? t('DeleteDevelopmentServerDialog.error') : undefined
      }
      title={t('DeleteDevelopmentServerDialog.title')}
      confirmText={t('DeleteDevelopmentServerDialog.confirm')}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    >
      {t('DeleteDevelopmentServerDialog.description')}
    </Dialog>
  );
}

const LIMIT = 10;

const updateDevelopmentDetailsDialogSchema = z.object({
  name: z.string().min(3).max(50),
  password: z.string(),
  url: z.string().url(),
});

type UpdateDevelopmentDetailsDialogValues = z.infer<
  typeof updateDevelopmentDetailsDialogSchema
>;

interface UpdateDevelopmentServerDetailsDialogProps {
  trigger: React.ReactNode;
  id: string;
  name: string;
  password: string;
  url: string;
}

function UpdateDevelopmentServerDetailsDialog(
  props: UpdateDevelopmentServerDetailsDialogProps
) {
  const { resetAllLettaAgentsQueryKeys } = useResetAllLettaAgentsQueryKeys();

  const t = useTranslations('development-servers/page');
  const [isOpen, setIsOpen] = useState(false);
  const { trigger, ...rest } = props;
  const queryClient = useQueryClient();

  const form = useForm<UpdateDevelopmentDetailsDialogValues>({
    resolver: zodResolver(updateDevelopmentDetailsDialogSchema),
    defaultValues: {
      name: rest.name,
      password: rest.password,
      url: rest.url,
    },
  });

  const { mutate, isPending, isSuccess, reset, isError } =
    webApi.developmentServers.updateDevelopmentServer.useMutation({
      onSuccess: (_res, values) => {
        try {
          queryClient.setQueriesData<
            ServerInferResponses<
              typeof developmentServersContracts.getDevelopmentServers,
              200
            >
          >(
            {
              queryKey:
                webApiQueryKeys.developmentServers.getDevelopmentServers,
              exact: true,
            },
            (oldData) => {
              if (!oldData) {
                return oldData;
              }

              return {
                ...oldData,
                body: {
                  ...oldData.body,
                  developmentServers: oldData.body.developmentServers.map(
                    (server) => {
                      if (server.id === rest.id) {
                        return {
                          ...server,
                          name: values.body?.name || server.name,
                          password: values.body?.password || server.password,
                          url: values.body?.url || server.url,
                        };
                      }

                      return server;
                    }
                  ),
                },
              };
            }
          );

          queryClient.setQueriesData<
            ServerInferResponses<
              typeof developmentServersContracts.getDevelopmentServer,
              200
            >
          >(
            {
              queryKey: webApiQueryKeys.developmentServers.getDevelopmentServer(
                rest.id || ''
              ),
              exact: true,
            },
            (oldData) => {
              if (!oldData) {
                return oldData;
              }

              return {
                ...oldData,
                body: {
                  ...oldData.body,
                  developmentServer: {
                    ...oldData.body.developmentServer,
                    name:
                      values.body?.name || oldData.body.developmentServer.name,
                    password:
                      values.body?.password ||
                      oldData.body.developmentServer.password,
                    url: values.body?.url || oldData.body.developmentServer.url,
                  },
                },
              };
            }
          );

          setTimeout(() => {
            resetAllLettaAgentsQueryKeys();
          }, 1);

          reset();
          setIsOpen(false);
        } catch (e) {
          console.error(e);
        }
      },
    });

  const handleUpdate = useCallback(
    (values: UpdateDevelopmentDetailsDialogValues) => {
      if (isPending || isSuccess) {
        return;
      }

      mutate({
        params: {
          developmentServerId: rest.id || '',
        },
        body: {
          name: values.name,
          password: values.password,
          url: values.url,
        },
      });
    },
    [isPending, rest, isSuccess, mutate]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        trigger={trigger}
        errorMessage={
          isError ? t('UpdateDevelopmentServerDetailsDialog.error') : undefined
        }
        title={t('UpdateDevelopmentServerDetailsDialog.title')}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSubmit={form.handleSubmit(handleUpdate)}
        confirmText={t('UpdateDevelopmentServerDetailsDialog.confirm')}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              label={t('UpdateDevelopmentServerDetailsDialog.name.label')}
              fullWidth
              {...field}
            />
          )}
        />
        <FormField
          name="password"
          render={({ field }) => (
            <Input
              showVisibilityControls
              label={t('UpdateDevelopmentServerDetailsDialog.password.label')}
              fullWidth
              {...field}
            />
          )}
        />
        <FormField
          name="url"
          render={({ field }) => (
            <Input
              label={t('UpdateDevelopmentServerDetailsDialog.url.label')}
              fullWidth
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

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
      name.toLowerCase().includes(search.toLowerCase())
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

  const { formatDate } = useDateFormatter();

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
          return formatDate(row.original?.created_at || '');
        },
      },
      {
        header: '',
        id: 'actions',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: ({ row }) => (
          <Button
            href={`/development-servers/${
              currentDevelopmentServerConfig?.id || 'local'
            }/agents/${row.original.id}`}
            color="tertiary"
            label={t('table.openInADE')}
          />
        ),
      },
    ],
    [t, formatDate, currentDevelopmentServerConfig?.id]
  );

  return (
    <DashboardPageLayout encapsulatedFullHeight>
      <DashboardPageSection
        fullHeight
        description={t('description')}
        title={currentDevelopmentServerConfig?.name || ''}
        searchValue={search}
        onSearch={!isError ? setSearch : undefined}
        searchPlaceholder={t('searchInput.placeholder')}
        actions={
          <HStack>
            <CreateLocalAgentDialog
              trigger={
                <Button
                  preIcon={<PlusIcon />}
                  color="secondary"
                  label={t('createAgent')}
                />
              }
            />

            {currentDevelopmentServerConfig &&
              currentDevelopmentServerConfig?.id !== 'local' && (
                <DropdownMenu
                  triggerAsChild
                  trigger={
                    <Button
                      hideLabel
                      color="tertiary"
                      preIcon={<DotsHorizontalIcon />}
                      label={t('settings')}
                    />
                  }
                >
                  <UpdateDevelopmentServerDetailsDialog
                    trigger={
                      <DropdownMenuItem
                        preIcon={<CogIcon />}
                        doNotCloseOnSelect
                        label={t('updateDetails')}
                      />
                    }
                    name={currentDevelopmentServerConfig.name}
                    password={currentDevelopmentServerConfig.password || ''}
                    url={currentDevelopmentServerConfig.url}
                    id={currentDevelopmentServerConfig.id}
                  />
                  <DeleteDevelopmentServerDialog
                    trigger={
                      <DropdownMenuItem
                        preIcon={<TrashIcon />}
                        doNotCloseOnSelect
                        label={t('delete')}
                      />
                    }
                    id={currentDevelopmentServerConfig.id}
                  />
                </DropdownMenu>
              )}
          </HStack>
        }
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
