'use client';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
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
  isMultiValue,
  PlusIcon,
  RawInput,
  Select,
  TrashIcon,
  Typography,
  useForm,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ListProvidersResponse, Provider } from '@letta-cloud/sdk-core';
import {
  useProvidersServiceCreateProvider,
  useProvidersServiceDeleteProvider,
  useProvidersServiceListProviders,
  UseProvidersServiceListProvidersKeyFn,
  useProvidersServiceModifyProvider,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { useFormatters } from '@letta-cloud/utils-client';
import { getUseProvidersServiceModelsStandardArgs } from '../../../models/_components/utils/getUseProvidersServiceModelsStandardArgs/getUseProvidersServiceModelsStandardArgs';

const UpdateModelProviderSchema = z.object({
  apiKey: z.string(),
});

interface UpdateModelProviderDialogProps {
  modelProviderId: string;
  modelProviderName: string;
}

function UpdateModelProviderDialog(props: UpdateModelProviderDialogProps) {
  const queryClient = useQueryClient();
  const t = useTranslations('organization/model-providers');
  const { modelProviderId, modelProviderName } = props;
  const [open, setOpen] = useState(false);

  const { mutate, isPending, error, reset } = useProvidersServiceModifyProvider(
    {
      onSuccess: () => {
        queryClient.setQueriesData<ListProvidersResponse | undefined>(
          {
            queryKey: UseProvidersServiceListProvidersKeyFn(
              getUseProvidersServiceModelsStandardArgs(),
            ),
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return oldData.map((provider) => {
              if (provider.id === modelProviderId) {
                return {
                  ...provider,
                  updated_at: new Date().toISOString(),
                };
              }
              return provider;
            });
          },
        );
        setOpen(false);
        reset();
        form.reset();
      },
    },
  );

  const form = useForm<z.infer<typeof UpdateModelProviderSchema>>({
    resolver: zodResolver(UpdateModelProviderSchema),
    defaultValues: {
      apiKey: '',
    },
  });

  const handleSubmit = useCallback(
    async (input: z.infer<typeof UpdateModelProviderSchema>) => {
      mutate({
        providerId: modelProviderId,
        requestBody: {
          api_key: input.apiKey,
        },
      });
    },
    [mutate, modelProviderId],
  );

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
        title={t('UpdateModelProviderDialog.title')}
        isOpen={open}
        errorMessage={error ? t('UpdateModelProviderDialog.error') : undefined}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending}
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            label={t('UpdateModelProviderDialog.trigger')}
            color="secondary"
          />
        }
        testId="update-model-provider-dialog"
        cancelText={t('UpdateModelProviderDialog.cancel')}
        confirmText={t('UpdateModelProviderDialog.confirm')}
      >
        <RawInput
          fullWidth
          label={t('UpdateModelProviderDialog.name.label')}
          value={modelProviderName}
          disabled
        />
        <FormField
          name="apiKey"
          render={({ field }) => (
            <Input
              fullWidth
              {...field}
              placeholder={t('UpdateModelProviderDialog.apiKey.placeholder')}
              label={t('UpdateModelProviderDialog.apiKey.label')}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

interface DeleteModelProviderDialogProps {
  modelProviderId: string;
  modelProviderName: string;
}

function DeleteModelProviderDialog(props: DeleteModelProviderDialogProps) {
  const queryClient = useQueryClient();
  const t = useTranslations('organization/model-providers');
  const { modelProviderId, modelProviderName } = props;

  const { mutate, isPending, error, reset } = useProvidersServiceDeleteProvider(
    {
      onSuccess: () => {
        queryClient.setQueriesData<ListProvidersResponse | undefined>(
          {
            queryKey: UseProvidersServiceListProvidersKeyFn(),
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return oldData.filter(
              (provider) => provider.id !== modelProviderId,
            );
          },
        );
        setOpen(false);
        reset();
      },
    },
  );
  const [open, setOpen] = useState(false);
  const handleDelete = useCallback(() => {
    mutate({
      providerId: modelProviderId,
    });
  }, [mutate, modelProviderId]);

  return (
    <Dialog
      title={t('DeleteModelProviderDialog.title')}
      isOpen={open}
      onConfirm={handleDelete}
      onOpenChange={setOpen}
      isConfirmBusy={isPending}
      confirmText={t('DeleteModelProviderDialog.confirm')}
      cancelText={t('DeleteModelProviderDialog.cancel')}
      errorMessage={error ? t('DeleteModelProviderDialog.error') : undefined}
      trigger={
        <DropdownMenuItem
          doNotCloseOnSelect
          preIcon={<TrashIcon />}
          label={t('DeleteModelProviderDialog.trigger')}
          color="danger"
        />
      }
    >
      {t('DeleteModelProviderDialog.description', {
        name: modelProviderName,
      })}
    </Dialog>
  );
}

const AddModelProviderSchema = z.object({
  name: z.string(),
  apiKey: z.string(),
});

function AddModelProviderDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const t = useTranslations('organization/model-providers');
  const { mutate, isPending, error, reset } = useProvidersServiceCreateProvider(
    {
      onSuccess: async (response) => {
        setOpen(false);
        form.reset();

        queryClient.setQueriesData<ListProvidersResponse | undefined>(
          {
            queryKey: UseProvidersServiceListProvidersKeyFn(),
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return oldData
              .filter((provider) => provider.id !== response.id)
              .concat({
                ...response,
                updated_at: new Date().toISOString(),
              });
          },
        );
      },
    },
  );

  const errorTranslation = error
    ? t('CreateModelProviderDialog.errors.default')
    : undefined;

  const form = useForm<z.infer<typeof AddModelProviderSchema>>({
    resolver: zodResolver(AddModelProviderSchema),
    defaultValues: {
      name: 'Anthropic',
      apiKey: '',
    },
  });

  const handleSubmit = useCallback(
    async (input: z.infer<typeof AddModelProviderSchema>) => {
      const existingProviders = queryClient.getQueryData<ListProvidersResponse>(
        UseProvidersServiceListProvidersKeyFn(),
      );

      if (
        existingProviders?.find((provider) => provider.name === 'Anthropic')
      ) {
        form.setError('name', {
          type: 'custom',
          message: t('CreateModelProviderDialog.errors.alreadyExists'),
        });
        return;
      }
      mutate({
        requestBody: {
          name: 'Anthropic',
          provider_type: 'anthropic',
          api_key: input.apiKey,
        },
      });
    },
    [mutate, form, queryClient, t],
  );

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
        title={t('CreateModelProviderDialog.title')}
        isOpen={open}
        errorMessage={errorTranslation}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending}
        trigger={
          <Button
            color="primary"
            preIcon={<PlusIcon />}
            label={t('CreateModelProviderDialog.trigger')}
          />
        }
        testId="create-environment-variable-dialog"
        cancelText={t('CreateModelProviderDialog.cancel')}
        confirmText={t('CreateModelProviderDialog.confirm')}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <Select
              fullWidth
              hideIconsOnOptions
              value={field.value.value}
              onSelect={(value) => {
                if (isMultiValue(value) || !value) {
                  return;
                }

                field.onChange(value.value);
              }}
              placeholder="Anthropic"
              options={[{ label: 'Anthropic', value: 'Anthropic' }]}
              label={t('CreateModelProviderDialog.name.label')}
            />
          )}
        />
        <FormField
          name="apiKey"
          render={({ field }) => (
            <Input
              fullWidth
              {...field}
              placeholder={t('CreateModelProviderDialog.apiKey.placeholder')}
              label={t('CreateModelProviderDialog.apiKey.label')}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

function ModelProvidersPage() {
  const t = useTranslations('organization/model-providers');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const { data, isFetching, error } = useProvidersServiceListProviders();
  const { formatDateAndTime } = useFormatters();

  const modelProvidersColumns: Array<ColumnDef<Provider>> = useMemo(
    () => [
      {
        header: t('modelProviderColumns.name'),
        accessorKey: 'name',
        cell: ({ cell }) => (
          <HStack align="center" gap="medium" as="span">
            <Typography>{cell.row.original.name}</Typography>
          </HStack>
        ),
      },
      {
        header: t('modelProviderColumns.updatedAt'),
        accessorKey: 'updated_at',
        cell: ({ cell }) => {
          if (!cell.row.original.updated_at) {
            return '';
          }

          return formatDateAndTime(cell.row.original.updated_at);
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
          return (
            <DropdownMenu
              trigger={
                <Button
                  data-testid={`model-provider-actions-button:${cell.row.original.name}`}
                  color="tertiary"
                  label={t('modelProviderColumns.actions')}
                  preIcon={<DotsHorizontalIcon />}
                  size="small"
                  hideLabel
                />
              }
              triggerAsChild
            >
              <UpdateModelProviderDialog
                modelProviderId={cell.row.original.id!}
                modelProviderName={cell.row.original.name}
              />
              <DeleteModelProviderDialog
                modelProviderId={cell.row.original.id!}
                modelProviderName={cell.row.original.name}
              />
            </DropdownMenu>
          );
        },
      },
    ],
    [t, formatDateAndTime],
  );

  return (
    <DashboardPageLayout
      actions={<AddModelProviderDialog />}
      encapsulatedFullHeight
      title={t('title')}
      subtitle={t('description')}
    >
      <DashboardPageSection fullHeight width="capped">
        <DataTable
          isLoading={isFetching}
          limit={limit}
          offset={offset}
          hasNextPage={false}
          onSetOffset={setOffset}
          showPagination
          autofitHeight
          errorMessage={error ? t('errorMessage') : undefined}
          loadingText={t('loadingMessage')}
          onLimitChange={setLimit}
          columns={modelProvidersColumns}
          data={data || []}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default ModelProvidersPage;
