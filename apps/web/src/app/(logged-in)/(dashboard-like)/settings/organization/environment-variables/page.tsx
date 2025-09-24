'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
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
} from '@letta-cloud/ui-component-library';
import { webApi, webApiContracts, webApiQueryKeys } from '$web/client';
import React, { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  GetEnvironmentVariables200Response,
  PublicEnvironmentVariable,
} from '$web/web-api/contracts';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';

interface DeleteEnvironmentVariableDialogProps {
  environmentVariableKey: string;
  environmentVariableId: string;
}

function DeleteEnvironmentVariableDialog(
  props: DeleteEnvironmentVariableDialogProps,
) {
  const { environmentVariableKey, environmentVariableId } = props;
  const queryClient = useQueryClient();
  const t = useTranslations('organization/environment-variables');
  const { mutate, isPending } =
    webApi.environmentVariables.deleteEnvironmentVariable.useMutation();
  const [open, setOpen] = useState(false);
  const handleDelete = useCallback(async () => {
    mutate(
      {
        params: {
          id: environmentVariableId,
        },
      },
      {
        onSuccess: () => {
          void queryClient.setQueriesData<
            GetEnvironmentVariables200Response | undefined
          >(
            {
              queryKey:
                webApiQueryKeys.environmentVariables.getEnvironmentVariables,
            },
            (oldData) => {
              if (!oldData) {
                return oldData;
              }

              return {
                ...oldData,
                body: {
                  ...oldData.body,
                  environmentVariables:
                    oldData.body.environmentVariables.filter(
                      (environmentVariable) =>
                        environmentVariable.key !== environmentVariableKey,
                    ),
                },
              };
            },
          );

          setOpen(false);
        },
      },
    );
  }, [mutate, queryClient, environmentVariableId, environmentVariableKey]);

  return (
    <Dialog
      title={t('DeleteEnvironmentVariableDialog.title')}
      isOpen={open}
      onConfirm={handleDelete}
      onOpenChange={setOpen}
      isConfirmBusy={isPending}
      confirmText={t('DeleteEnvironmentVariableDialog.confirm')}
      cancelText={t('DeleteEnvironmentVariableDialog.cancel')}
      trigger={
        <DropdownMenuItem
          doNotCloseOnSelect
          preIcon={<TrashIcon />}
          label={t('DeleteEnvironmentVariableDialog.trigger')}
          color="danger"
        />
      }
    >
      {t('DeleteEnvironmentVariableDialog.description', {
        key: environmentVariableKey,
      })}
    </Dialog>
  );
}

interface UpdateEnvironmentVariableDialogProps {
  environmentVariableKey: string;
}

function UpdateEnvironmentVariableDialog(
  props: UpdateEnvironmentVariableDialogProps,
) {
  const queryClient = useQueryClient();
  const { environmentVariableKey } = props;
  const [open, setOpen] = useState(false);
  const t = useTranslations('organization/environment-variables');
  const { mutate, isPending, isError } =
    webApi.environmentVariables.setEnvironmentVariable.useMutation();

  const UpdateEnvironmentVariableSchema = useMemo(() => {
    return z.object({
      value: z.string(),
    });
  }, []);

  const form = useForm<z.infer<typeof UpdateEnvironmentVariableSchema>>({
    resolver: zodResolver(UpdateEnvironmentVariableSchema),
    defaultValues: {
      value: '',
    },
  });

  const handleSubmit = useCallback(
    async (values: z.infer<typeof UpdateEnvironmentVariableSchema>) => {
      mutate(
        {
          body: {
            key: environmentVariableKey,
            value: values.value,
          },
        },
        {
          onSuccess: (response) => {
            setOpen(false);
            queryClient.setQueriesData<
              GetEnvironmentVariables200Response | undefined
            >(
              {
                queryKey:
                  webApiQueryKeys.environmentVariables.getEnvironmentVariables,
              },
              (oldData) => {
                if (!oldData) {
                  return oldData;
                }

                return {
                  ...oldData,
                  body: {
                    ...oldData.body,
                    environmentVariables: oldData.body.environmentVariables.map(
                      (environmentVariable) => {
                        if (environmentVariable.key === response.body.key) {
                          return {
                            ...environmentVariable,
                            updatedAt: new Date().toISOString(),
                          };
                        }

                        return environmentVariable;
                      },
                    ),
                  },
                };
              },
            );

            setOpen(false);
          },
        },
      );
    },
    [environmentVariableKey, mutate, queryClient],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            form.reset();
          }

          setOpen(isOpen);
        }}
        title={t('UpdateEnvironmentVariableDialog.title')}
        isOpen={open}
        errorMessage={
          isError ? t('UpdateEnvironmentVariableDialog.error') : undefined
        }
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending}
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            label={t('UpdateEnvironmentVariableDialog.trigger')}
            color="primary"
          />
        }
        testId="update-environment-variable-dialog"
        cancelText={t('UpdateEnvironmentVariableDialog.cancel')}
        confirmText={t('UpdateEnvironmentVariableDialog.confirm')}
      >
        <RawInput
          fullWidth
          label={t('UpdateEnvironmentVariableDialog.key.label')}
          value={environmentVariableKey}
          disabled
        />
        <FormField
          name="value"
          render={({ field }) => (
            <Input
              fullWidth
              {...field}
              placeholder={t(
                'UpdateEnvironmentVariableDialog.value.placeholder',
              )}
              label={t('UpdateEnvironmentVariableDialog.value.label')}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

function CreateEnvironmentVariableDialog() {
  const [hasPermission] = useUserHasPermission(
    ApplicationServices.UPDATE_ORGANIZATION_ENVIRONMENT_VARIABLES,
  );
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const t = useTranslations('organization/environment-variables');
  const { mutate, isPending, error, reset } =
    webApi.environmentVariables.createEnvironmentVariable.useMutation();

  const errorTranslation = useErrorTranslationMessage(error, {
    messageMap: {
      keyAlreadyExists: t(
        'CreateEnvironmentVariableDialog.errors.keyAlreadyExists',
      ),

      default: t('CreateEnvironmentVariableDialog.errors.default'),
    },
    contract: webApiContracts.environmentVariables.createEnvironmentVariable,
  });

  const CreateEnvironmentVariableSchema = useMemo(() => {
    return z.object({
      key: z.string().regex(/^[a-zA-Z0-9_]+$/, {
        message: t('CreateEnvironmentVariableDialog.key.error'),
      }),
      value: z.string(),
    });
  }, [t]);

  const form = useForm<z.infer<typeof CreateEnvironmentVariableSchema>>({
    resolver: zodResolver(CreateEnvironmentVariableSchema),
    defaultValues: {
      key: '',
      value: '',
    },
  });

  const handleSubmit = useCallback(
    async (values: z.infer<typeof CreateEnvironmentVariableSchema>) => {
      mutate(
        {
          body: values,
        },
        {
          onSuccess: (response) => {
            setOpen(false);
            void queryClient.setQueriesData<
              GetEnvironmentVariables200Response | undefined
            >(
              {
                queryKey:
                  webApiQueryKeys.environmentVariables.getEnvironmentVariables,
              },
              (oldData) => {
                if (!oldData) {
                  return oldData;
                }

                return {
                  ...oldData,
                  body: {
                    ...oldData.body,
                    environmentVariables: [
                      ...oldData.body.environmentVariables.filter(
                        (environmentVariable) =>
                          environmentVariable.key !== values.key,
                      ),
                      {
                        key: values.key,
                        updatedAt: new Date().toISOString(),
                        id: response.body.id,
                      },
                    ],
                  },
                };
              },
            );

            reset();
            form.reset();
          },
        },
      );
    },
    [form, mutate, queryClient, reset],
  );

  if (!hasPermission) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            form.reset();
            reset();
          }

          setOpen(isOpen);
        }}
        title={t('CreateEnvironmentVariableDialog.title')}
        isOpen={open}
        errorMessage={errorTranslation?.message}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending}
        trigger={
          <Button
            color="primary"
            preIcon={<PlusIcon />}
            label={t('CreateEnvironmentVariableDialog.trigger')}
          />
        }
        testId="create-environment-variable-dialog"
        cancelText={t('CreateEnvironmentVariableDialog.cancel')}
        confirmText={t('CreateEnvironmentVariableDialog.confirm')}
      >
        <FormField
          name="key"
          render={({ field }) => (
            <Input
              fullWidth
              {...field}
              placeholder={t('CreateEnvironmentVariableDialog.key.placeholder')}
              label={t('CreateEnvironmentVariableDialog.key.label')}
            />
          )}
        />
        <FormField
          name="value"
          render={({ field }) => (
            <Input
              fullWidth
              {...field}
              placeholder={t(
                'CreateEnvironmentVariableDialog.value.placeholder',
              )}
              label={t('CreateEnvironmentVariableDialog.value.label')}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}


function EnvironmentVariablesPage() {
  const t = useTranslations('organization/environment-variables');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const { data, isFetching, isError } =
    webApi.environmentVariables.getEnvironmentVariables.useQuery({
      queryKey: webApiQueryKeys.environmentVariables.getEnvironmentVariables,
      queryData: {
        query: {},
      },
    });
  const [hasPermission] = useUserHasPermission(
    ApplicationServices.UPDATE_ORGANIZATION_ENVIRONMENT_VARIABLES,
  );

  const environmentVariablesColumns: Array<
    ColumnDef<PublicEnvironmentVariable>
  > = useMemo(
    () => [
      {
        header: t('environmentVariablesColumns.key'),
        accessorKey: 'key',
        cell: ({ cell }) => (
          <HStack align="center" gap="medium" as="span">
            <Typography>{cell.row.original.key}</Typography>
          </HStack>
        ),
      },
      {
        header: t('environmentVariablesColumns.lastUpdated'),
        accessorKey: 'lastUpdated',
        cell: ({ cell }) => {
          if (!cell.row.original.updatedAt) {
            return '';
          }

          return new Date(cell.row.original.updatedAt).toLocaleString();
        },
      },
      {
        header: '',
        accessorKey: 'id',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        id: 'actions',
        cell: ({ cell }) => {
          if (!hasPermission) {
            return null;
          }

          return (
            <DropdownMenu
              trigger={
                <Button
                  data-testid={`environment-variable-actions-button:${cell.row.original.key}`}
                  color="tertiary"
                  label={t('environmentVariablesColumns.actions')}
                  preIcon={<DotsHorizontalIcon />}
                  size="small"
                  hideLabel
                />
              }
              triggerAsChild
            >
              <UpdateEnvironmentVariableDialog
                environmentVariableKey={cell.row.original.key}
              />
              <DeleteEnvironmentVariableDialog
                environmentVariableId={cell.row.original.id}
                environmentVariableKey={cell.row.original.key}
              />
            </DropdownMenu>
          );
        },
      },
    ],
    [t, hasPermission],
  );

  const environmentVariables = useMemo(() => {
    if (!data?.body.environmentVariables) {
      return [];
    }

    return data.body.environmentVariables.map((environmentVariable) => ({
      key: environmentVariable.key,
      updatedAt: environmentVariable.updatedAt,
      id: environmentVariable.id,
    }));
  }, [data]);

  return (
    <DashboardPageLayout
      actions={<CreateEnvironmentVariableDialog />}
      encapsulatedFullHeight
      title={t('title')}
      subtitle={t('description')}
    >
      <DashboardPageSection fullHeight>
        <DataTable
          isLoading={isFetching}
          limit={limit}
          offset={offset}
          hasNextPage={data?.body.hasNextPage}
          onSetOffset={setOffset}
          showPagination
          autofitHeight
          errorMessage={isError ? t('errorMessage') : undefined}
          loadingText={t('loadingMessage')}
          onLimitChange={setLimit}
          columns={environmentVariablesColumns}
          data={environmentVariables}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default EnvironmentVariablesPage;
