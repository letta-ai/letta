'use client';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  CopyButton,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  DotsHorizontalIcon,
  DownloadButton,
  DropdownMenu,
  DropdownMenuLabel,
  FormField,
  FormProvider,
  Input,
  PlusIcon,
  RawInput,
  TrashIcon,
  Typography,
  useForm,
  VStack,
  HStack,
  EyeOpenIcon,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi, webApiContracts, webApiQueryKeys } from '$web/client';
import type { APIKeyType } from '$web/web-api/contracts';
import type { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useCurrentUser, useUserHasPermission } from '$web/client/hooks';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { useOrganizationBillingTier } from '$web/client/hooks/useOrganizationBillingTier/useOrganizationBillingTier';

const CreateAPIKeySchema = z.object({
  name: z.string(),
});

function CreateAPIKeyDialog() {
  const [generatedKey, setGeneratedKey] = React.useState<string | null>(null);
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const t = useTranslations('api-keys/page');
  const { mutate, isPending, error } = webApi.apiKeys.createAPIKey.useMutation({
    onSuccess: (response) => {
      trackClientSideEvent(AnalyticsEvent.CREATE_API_KEY, {
        activeOrganizationId: user?.activeOrganizationId || '',
      });

      setGeneratedKey(response.body.apiKey);

      void queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.apiKeys.getAPIKeys,
      });
    },
  });

  const billingTier = useOrganizationBillingTier();
  const limits = getUsageLimits(billingTier || 'free');

  const errorMessage = useErrorTranslationMessage(error, {
    messageMap: {
      maxUsage: t('CreateAPIKeyDialog.errors.overage', {
        limit: limits.apiKeys,
      }),
      default: t('CreateAPIKeyDialog.errors.default'),
    },
    contract: webApiContracts.apiKeys.createAPIKey,
  });

  const form = useForm<z.infer<typeof CreateAPIKeySchema>>({
    resolver: zodResolver(CreateAPIKeySchema),
    defaultValues: {
      name: '',
    },
  });

  const handleSubmit = useCallback(
    async (values: z.infer<typeof CreateAPIKeySchema>) => {
      mutate({ body: values });
    },
    [mutate],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={errorMessage?.message}
        preventCloseFromOutside
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            form.reset();
            setGeneratedKey(null);
          }
        }}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending}
        hideConfirm={!!generatedKey}
        testId="create-api-key-dialog"
        cancelText={
          generatedKey
            ? t('createAPIKeyDialog.close')
            : t('createAPIKeyDialog.cancel')
        }
        title={
          generatedKey
            ? t('createAPIKeyDialog.createdTitle')
            : t('createAPIKeyDialog.title')
        }
        trigger={
          <Button
            data-testid="create-api-key-button"
            preIcon={<PlusIcon />}
            label={t('createAPIKeyDialog.trigger')}
          />
        }
      >
        {generatedKey ? (
          <>
            <Alert variant="warning" title={t('createAPIKeyDialog.alertTitle')}>
              <Typography>
                We have generated you an API Key, please make sure to store it
                safely.
              </Typography>
              <VStack align="center" paddingY="large">
                <DownloadButton
                  fullWidth
                  textToDownload={generatedKey}
                  fileName="api-key.txt"
                  downloadButtonText={t('createAPIKeyDialog.downloadText')}
                />
                <CopyButton
                  testId="copy-api-key-button"
                  fullWidth
                  textToCopy={generatedKey}
                  copyButtonText={t('createAPIKeyDialog.copyToClipboard')}
                />
              </VStack>
            </Alert>
          </>
        ) : (
          <FormField
            render={({ field }) => {
              return (
                <Input
                  data-testid="api-key-name-input"
                  fullWidth
                  {...field}
                  label={t('createAPIKeyDialog.label')}
                  description={t('createAPIKeyDialog.description')}
                />
              );
            }}
            name="name"
          />
        )}
      </Dialog>
    </FormProvider>
  );
}

interface DeleteAPIKeyDialogProps {
  apiKeyId: string;
  name: string;
}

function DeleteAPIKeyDialog(props: DeleteAPIKeyDialogProps) {
  const { apiKeyId, name } = props;
  const t = useTranslations('api-keys/page');
  const queryClient = useQueryClient();
  const { mutate, isPending } = webApi.apiKeys.deleteAPIKey.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.apiKeys.getAPIKeys,
      });
    },
  });

  const handleDelete = useCallback(() => {
    mutate({
      params: {
        apiKeyId,
      },
    });
  }, [apiKeyId, mutate]);

  return (
    <Dialog
      isConfirmBusy={isPending}
      onConfirm={handleDelete}
      confirmText={t('deleteApiKeyDialog.confirmText')}
      confirmColor="destructive"
      testId={`delete-api-key-dialog:${name}`}
      trigger={
        <DropdownMenuLabel
          data-testid={`delete-api-key-button:${name}`}
          preIcon={<TrashIcon />}
          text={t('deleteApiKeyDialog.trigger')}
        />
      }
      title={t('deleteApiKeyDialog.title', { apiKeyName: name })}
    >
      {t('deleteApiKeyDialog.confirmation')}
    </Dialog>
  );
}

interface ViewAPIKeyDialogProps {
  apiKeyId: string;
  name: string;
}

function ViewAPIKeyDialog(props: ViewAPIKeyDialogProps) {
  const { apiKeyId, name } = props;
  const { data } = webApi.apiKeys.getAPIKey.useQuery({
    queryKey: webApiQueryKeys.apiKeys.getApiKey(apiKeyId),
    queryData: {
      params: {
        apiKeyId,
      },
    },
  });

  const t = useTranslations('api-keys/page');

  return (
    <Dialog
      testId={`view-api-key-dialog:${name}`}
      trigger={
        <DropdownMenuLabel
          data-testid={`view-api-key-button:${name}`}
          preIcon={<EyeOpenIcon />}
          text={t('viewApiKeyDialog.trigger')}
        />
      }
      title={t('viewApiKeyDialog.title', { apiKeyName: name })}
    >
      <RawInput
        allowCopy
        fullWidth
        data-testid={`view-api-key-input:${name}`}
        label={t('viewApiKeyDialog.label')}
        value={data?.body.apiKey}
        readOnly
        disabled
        showVisibilityControls
      />
    </Dialog>
  );
}

interface CopyAPIKeyButtonProps {
  apiKeyId: string;
  name: string;
}

function CopyAPIKeyButton(props: CopyAPIKeyButtonProps) {
  const { apiKeyId, name } = props;
  const { data } = webApi.apiKeys.getAPIKey.useQuery({
    queryKey: webApiQueryKeys.apiKeys.getApiKey(apiKeyId),
    queryData: {
      params: {
        apiKeyId,
      },
    },
  });

  const t = useTranslations('api-keys/page');

  return (
    <CopyButton
      data-testid={`copy-api-key-button:${name}`}
      textToCopy={data?.body.apiKey || ''}
      size="small"
      hideLabel
      copyButtonText={t('copyApiKeyButton.copyButtonText')}
    />
  );
}

function APIKeysPage() {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);

  const [canReadKeys] = useUserHasPermission(ApplicationServices.READ_API_KEYS);
  const [canDeleteKey] = useUserHasPermission(
    ApplicationServices.DELETE_API_KEY,
  );
  const [canCreateKey] = useUserHasPermission(
    ApplicationServices.CREATE_API_KEY,
  );

  const { data, isFetching, isError } = webApi.apiKeys.getAPIKeys.useQuery({
    queryKey: webApiQueryKeys.apiKeys.getAPIKeysWithSearch({
      offset,
      limit,
    }),
    queryData: {
      query: {
        offset,
        limit,
      },
    },
    enabled: canReadKeys,
  });

  const t = useTranslations('api-keys/page');

  const apiKeysColumns: Array<ColumnDef<APIKeyType>> = useMemo(
    () => [
      {
        header: t('apiKeysColumns.name'),
        accessorKey: 'name',
      },
      {
        header: '',
        accessorKey: 'id',
        id: 'actions',
        cell: ({ cell }) => {
          return (
            <HStack justify="end">
              <DropdownMenu
                trigger={
                  <Button
                    data-testid={`api-key-actions-button:${cell.row.original.name}`}
                    color="tertiary"
                    label={t('apiKeysColumns.actions')}
                    preIcon={<DotsHorizontalIcon />}
                    size="small"
                    hideLabel
                  />
                }
                triggerAsChild
              >
                <ViewAPIKeyDialog
                  apiKeyId={cell.row.original.id}
                  name={cell.row.original.name}
                />
                {canDeleteKey && (
                  <DeleteAPIKeyDialog
                    name={cell.row.original.name}
                    apiKeyId={cell.row.original.id}
                  />
                )}
              </DropdownMenu>
              <CopyAPIKeyButton
                apiKeyId={cell.row.original.id}
                name={cell.row.original.name}
              />
            </HStack>
          );
        },
      },
    ],
    [t, canDeleteKey],
  );

  const apiKeys = useMemo(() => {
    if (data?.status === 200) {
      return data.body.apiKeys;
    }
    return undefined;
  }, [data]);

  return (
    <DashboardPageLayout
      encapsulatedFullHeight
      title="API keys"
      actions={
        canCreateKey ? (
          <>
            <CreateAPIKeyDialog />
          </>
        ) : null
      }
    >
      <DashboardPageSection fullHeight>
        <DataTable
          isLoading={isFetching}
          limit={limit}
          offset={offset}
          hasNextPage={data?.body.hasNextPage}
          onSetOffset={setOffset}
          noResultsAction={canCreateKey ? <CreateAPIKeyDialog /> : null}
          showPagination
          autofitHeight
          errorMessage={isError ? t('errorMessage') : undefined}
          noResultsText={t('emptyMessage')}
          loadingText={t('loadingMessage')}
          onLimitChange={setLimit}
          columns={apiKeysColumns}
          data={apiKeys || []}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default APIKeysPage;
