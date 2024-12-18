'use client';
import React, { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import IntegrationPageLayout from '../common/IntegrationPageLayout/IntegrationPageLayout';
import {
  Alert,
  Button,
  ComposioLockup,
  Dialog,
  FormField,
  FormProvider,
  HStack,
  Input,
  RawInput,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { GetEnvironmentVariableByKey200Response } from '$letta/web-api/environment-variables/environmentVariablesContracts';
import { COMPOSIO_KEY_NAME } from '$letta/web-api/environment-variables/environmentVariablesContracts';
import { useQueryClient } from '@tanstack/react-query';

function useIsComposioConnected() {
  const { data } =
    webApi.environmentVariables.getEnvironmentVariableByKey.useQuery({
      queryData: {
        params: {
          key: COMPOSIO_KEY_NAME,
        },
      },
      retry: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      queryKey:
        webApiQueryKeys.environmentVariables.getEnvironmentVariableByKey(
          COMPOSIO_KEY_NAME
        ),
    });

  return {
    isConnected: data?.status === 200,
    envId: data?.body?.id,
  };
}

function DisconnectIntegrationDialog() {
  const t = useTranslations('organization/integrations/composio');
  const { envId } = useIsComposioConnected();

  const { mutate, isPending, isError } =
    webApi.environmentVariables.deleteEnvironmentVariable.useMutation();
  const queryClient = useQueryClient();

  const handleDisconnect = useCallback(() => {
    mutate(
      {
        params: {
          id: envId || '',
        },
      },
      {
        onSuccess: () => {
          queryClient.setQueriesData(
            {
              queryKey:
                webApiQueryKeys.environmentVariables.getEnvironmentVariableByKey(
                  COMPOSIO_KEY_NAME
                ),
            },
            () => {
              return {
                status: 404,
                body: undefined,
              };
            }
          );
        },
      }
    );
  }, [envId, mutate, queryClient]);

  return (
    <Dialog
      onConfirm={handleDisconnect}
      isConfirmBusy={isPending}
      errorMessage={
        isError ? t('DisconnectIntegrationDialog.error') : undefined
      }
      title={t('DisconnectIntegrationDialog.title')}
      confirmText={t('DisconnectIntegrationDialog.confirm')}
      trigger={
        <Button
          color="destructive"
          label={t('DisconnectIntegrationDialog.trigger')}
        />
      }
    >
      <Typography>{t('DisconnectIntegrationDialog.description')}</Typography>
    </Dialog>
  );
}

const SetApiKeyFormSchema = z.object({
  apiKey: z.string(),
});

type SetApiKeyFormSchemaType = z.infer<typeof SetApiKeyFormSchema>;

function SetApiKeyDialog() {
  const t = useTranslations('organization/integrations/composio');
  const [isOpen, setIsOpen] = useState(false);
  const { isConnected } = useIsComposioConnected();

  const { mutate, reset, isPending, isError } =
    webApi.environmentVariables.setEnvironmentVariable.useMutation();
  const queryClient = useQueryClient();

  const form = useForm<SetApiKeyFormSchemaType>({
    resolver: zodResolver(SetApiKeyFormSchema),
    defaultValues: {
      apiKey: '',
    },
  });

  const handleSubmit = useCallback(
    (values: SetApiKeyFormSchemaType) => {
      mutate(
        {
          body: {
            value: values.apiKey,
            key: COMPOSIO_KEY_NAME,
          },
        },
        {
          onSuccess: (values) => {
            queryClient.setQueriesData<
              GetEnvironmentVariableByKey200Response | undefined
            >(
              {
                queryKey:
                  webApiQueryKeys.environmentVariables.getEnvironmentVariableByKey(
                    COMPOSIO_KEY_NAME
                  ),
              },
              () => {
                return {
                  status: 200,
                  body: {
                    id: values.body.id,
                    key: values.body.key,
                  },
                };
              }
            );

            form.reset();
            reset();
            setIsOpen(false);
          },
        }
      );
    },
    [form, mutate, queryClient, reset]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={isError ? t('SetApiKeyDialog.error') : undefined}
        onOpenChange={setIsOpen}
        isOpen={isOpen}
        isConfirmBusy={isPending}
        title={t('SetApiKeyDialog.title')}
        onSubmit={form.handleSubmit(handleSubmit)}
        confirmText={t('SetApiKeyDialog.confirm')}
        trigger={
          <Button color="secondary" label={t('configuration.apiKey.update')} />
        }
      >
        {isConnected && (
          <Alert title={t('SetApiKeyDialog.alert')} variant="warning" />
        )}
        <FormField
          name="apiKey"
          render={({ field }) => {
            return (
              <Input
                showVisibilityControls
                fullWidth
                label={t('SetApiKeyDialog.label')}
                {...field}
              />
            );
          }}
        />
      </Dialog>
    </FormProvider>
  );
}

function ComposioConnectSection() {
  const t = useTranslations('organization/integrations/composio');

  const { isConnected } = useIsComposioConnected();

  return (
    <HStack fullWidth align="center">
      {isConnected ? (
        <RawInput
          hideLabel
          type="password"
          disabled
          value={t('configuration.hidden')}
          fullWidth
          label={t('configuration.apiKey.label')}
        />
      ) : (
        <RawInput
          hideLabel
          type="text"
          disabled
          value={t('configuration.noApiKey')}
          fullWidth
          label={t('configuration.apiKey.label')}
        />
      )}
      <SetApiKeyDialog />
    </HStack>
  );
}

function ComposioSettingsPage() {
  const t = useTranslations('organization/integrations/composio');
  const { isConnected } = useIsComposioConnected();

  return (
    <IntegrationPageLayout
      image={<ComposioLockup height={50} />}
      description={t('description')}
      disconnect={
        isConnected && (
          <div>
            <DisconnectIntegrationDialog />
          </div>
        )
      }
      website="https://app.composio.dev/settings"
      configuration={
        <VStack>
          <Typography>{t('configuration.description')}</Typography>
          <ComposioConnectSection />
          <Typography variant="body" color="muted">
            {t.rich('configuration.create', {
              link: (chunks) => (
                <Typography overrideEl="span" underline>
                  <a
                    href="https://app.composio.dev/settings"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {chunks}
                  </a>
                </Typography>
              ),
            })}
          </Typography>
        </VStack>
      }
      usage={
        <VStack>
          <Typography>{t('usage.description')}</Typography>
        </VStack>
      }
    ></IntegrationPageLayout>
  );
}

export default ComposioSettingsPage;
