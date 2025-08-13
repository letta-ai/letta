import {
  brandKeyToLogo,
  brandKeyToName,
  Button,
  CheckIcon,
  CloseIcon,
  Dialog,
  FormField,
  FormProvider,
  HStack,
  Input,
  InputContainer,
  StatusIndicator,
  TabGroup,
  Tooltip,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import type {
  ListProvidersResponse,
  ProviderType,
} from '@letta-cloud/sdk-core';
import {
  isAPIError,
  useProvidersServiceCreateProvider,
  UseProvidersServiceListProvidersKeyFn,
} from '@letta-cloud/sdk-core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getUseProvidersServiceModelsStandardArgs } from '../utils/getUseProvidersServiceModelsStandardArgs/getUseProvidersServiceModelsStandardArgs';
import { useFormContext } from 'react-hook-form';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useCurrentUser } from '$web/client/hooks';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

function TestConnectionButton() {
  const [isTesting, setIsTesting] = useState(false);
  const [testingStatus, setTestingStatus] = useState<
    'failed' | 'success' | null
  >(null);
  const t = useTranslations('pages/models/CreateProviderModal');

  const { watch } = useFormContext();

  const testConnection = useCallback(
    async ({
      providerType,
      apiKey,
      accessKey,
      region,
      baseUrl,
      apiVersion,
    }: {
      providerType: ProviderType;
      apiKey: string;
      accessKey?: string;
      region?: string;
      baseUrl?: string;
      apiVersion?: string;
    }) => {
      try {
        setIsTesting(true);
        setTestingStatus(null);

        const res = await fetch(`/v1/providers/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: apiKey,
            provider_type: providerType,
            access_key: accessKey,
            region: region,
            base_url: baseUrl,
            api_version: apiVersion,
          }),
        });

        if (res.status !== 200) {
          throw new Error('Failed to connect');
        }

        setTestingStatus('success');
      } catch (_) {
        setTestingStatus('failed');
      } finally {
        setIsTesting(false);
      }
    },
    [],
  );

  const apiKey = watch('apiKey');
  const providerType = watch('providerType');
  const accessKey = watch('accessKey');
  const region = watch('region');
  const baseUrl = watch('baseUrl');
  const apiVersion = watch('apiVersion');

  return (
    <HStack
      align="center"
      justify="spaceBetween"
      padding="small"
      paddingRight
      border
      fullWidth
    >
      <Button
        type="button"
        color="secondary"
        busy={isTesting}
        label={t('TestConnectionButton.label')}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void testConnection({ providerType, apiKey, accessKey, region, baseUrl, apiVersion });
        }}
      />
      <HStack>
        {testingStatus === 'success' && (
          <Tooltip content={t('TestConnectionButton.success.tooltip')}>
            <HStack>
              <CheckIcon color="positive" />
              <Typography variant="body2" bold>
                {t('TestConnectionButton.success.label')}
              </Typography>
            </HStack>
          </Tooltip>
        )}
        {testingStatus === 'failed' && (
          <Tooltip content={t('TestConnectionButton.failed.tooltip')}>
            <HStack>
              <CloseIcon color="destructive" />
              <Typography variant="body2" bold>
                {t('TestConnectionButton.failed.label')}
              </Typography>
            </HStack>
          </Tooltip>
        )}
        {testingStatus === null && (
          <HStack align="center">
            <StatusIndicator status="processing" />
            {isTesting ? (
              <Typography variant="body2" bold>
                {t('TestConnectionButton.pending')}
              </Typography>
            ) : (
              <Typography variant="body2" bold>
                {t('TestConnectionButton.unconnected')}
              </Typography>
            )}
          </HStack>
        )}
      </HStack>
    </HStack>
  );
}

interface CreateProviderModalProps {
  trigger: React.ReactNode;
}

const AddModelProviderSchema = z.object({
  providerType: z.enum(['anthropic', 'openai', 'google_ai', 'bedrock', 'azure', 'together']),
  name: z.string().min(1),
  apiKey: z.string().min(1),
  accessKey: z.string().optional(),
  region: z.string().optional(),
  baseUrl: z.string().optional(),
  apiVersion: z.string().optional(),
});

type AddModelProviderSchema = z.infer<typeof AddModelProviderSchema>;

export function AddProviderModal(props: CreateProviderModalProps) {
  const { trigger } = props;
  const t = useTranslations('pages/models/CreateProviderModal');

  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const user = useCurrentUser();
  const { mutate, isPending, error } = useProvidersServiceCreateProvider();

  const form = useForm<AddModelProviderSchema>({
    resolver: zodResolver(AddModelProviderSchema),
    defaultValues: {
      providerType: 'openai',
      name: '',
      apiKey: '',
      accessKey: '',
      region: '',
      baseUrl: '',
      apiVersion: '',
    },
  });

  const { watch } = form;

  const { data: isAzureEnabled } = useFeatureFlag('BYOK_AZURE');
  const { data: isTogetherEnabled } = useFeatureFlag('BYOK_TOGETHER');

  const providerItems = useMemo(
    () => {
      const items = [
        {
          label: brandKeyToName('openai'),
          value: 'openai',
          icon: brandKeyToLogo('openai'),
        },
        {
          label: brandKeyToName('anthropic'),
          value: 'anthropic',
          icon: brandKeyToLogo('claude'),
        },
        {
          label: brandKeyToName('google_ai'),
          value: 'google_ai',
          icon: brandKeyToLogo('google_ai'),
        },
        {
          label: brandKeyToName('bedrock'),
          value: 'bedrock',
          icon: brandKeyToLogo('bedrock'),
        },
      ];

      if (isAzureEnabled) {
        items.push({
          label: brandKeyToName('azure'),
          value: 'azure',
          icon: brandKeyToLogo('azure'),
        });
      }

      if (isTogetherEnabled) {
        items.push({
          label: brandKeyToName('together'),
          value: 'together',
          icon: brandKeyToLogo('together'),
        });
      }

      return items;
    },
    [isAzureEnabled, isTogetherEnabled],
  )

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        form.reset();
      }
      setOpen(isOpen);
    },
    [form],
  );

  const handleSubmit = useCallback(
    async (data: AddModelProviderSchema) => {
      mutate(
        {
          requestBody: {
            provider_type: data.providerType,
            name: data.name,
            api_key: data.apiKey,
            access_key: data.accessKey,
            region: data.region,
            base_url: data.baseUrl,
            api_version: data.apiVersion,
          },
        },
        {
          onSuccess: (response) => {
            trackClientSideEvent(AnalyticsEvent.ADDED_OWN_EXTERNAL_KEY, {
              userId: user?.id || '',
            });
            queryClient.setQueriesData<ListProvidersResponse | undefined>(
              {
                queryKey: UseProvidersServiceListProvidersKeyFn(
                  getUseProvidersServiceModelsStandardArgs(),
                ),
              },
              (oldData) => {
                if (oldData) {
                  return [...oldData, response];
                }

                return [response];
              },
            );

            handleOpenChange(false);
          },
        },
      );
    },
    [handleOpenChange, mutate, queryClient, user?.id],
  );

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error)) {
        if (error.status === 409) {
          return t('errors.nameConflict');
        }

        if (error.status === 402) {
          return t('errors.tooManyProviders', {
            max: getUseProvidersServiceModelsStandardArgs().limit,
          });
        }

        if (error.body.detail) {
          return error.body.detail;
        }
      }

      return t('errors.default');
    }

    return '';
  }, [error, t]);

  return (
    <FormProvider {...form}>
      <Dialog
        trigger={trigger}
        isOpen={open}
        onOpenChange={handleOpenChange}
        onSubmit={form.handleSubmit(handleSubmit)}
        size="xlarge"
        isConfirmBusy={isPending}
        errorMessage={errorMessage}
        title={t('title')}
      >
        <VStack gap="form">
          <FormField
            name="providerType"
            render={({ field }) => (
              <InputContainer label={t('providerType.label')}>
                <TabGroup
                  variant="chips"
                  size="small"
                  color="dark"
                  items={providerItems}
                  onValueChange={(result) => {
                    if (result) {
                      field.onChange(result);
                    }
                  }}
                  value={field.value}
                />
              </InputContainer>
            )}
          ></FormField>
          <FormField
            name="name"
            render={({ field }) => (
              <Input
                label={t('name.label')}
                placeholder={t('name.placeholder')}
                fullWidth
                description={t('name.description')}
                {...field}
              />
            )}
          ></FormField>
          <FormField
            name="apiKey"
            render={({ field }) => (
              <Input
                label={
                  watch('providerType') === 'bedrock'
                    ? t('bedrock.secretKey')
                    : t('apiKey.label')
                }
                placeholder="••••••••••••••••••••••"
                type="password"
                fullWidth
                showVisibilityControls
                {...field}
              />
            )}
          ></FormField>
          {watch('providerType') === 'bedrock' && (
            <>
              <FormField
                name="accessKey"
                render={({ field }) => (
                  <Input
                    label={t('bedrock.accessKey.label')}
                    placeholder={t('bedrock.accessKey.placeholder')}
                    fullWidth
                    {...field}
                  />
                )}
              ></FormField>
              <FormField
                name="region"
                render={({ field }) => (
                  <Input
                    label={t('bedrock.region.label')}
                    placeholder={t('bedrock.region.placeholder')}
                    fullWidth
                    {...field}
                  />
                )}
              ></FormField>
            </>
          )}
          {watch('providerType') === 'azure' && (
            <>
              <FormField
                name="baseUrl"
                render={({ field }) => (
                  <Input
                    label={t('azure.baseUrl.label')}
                    placeholder={t('azure.baseUrl.placeholder')}
                    fullWidth
                    {...field}
                  />
                )}
              ></FormField>
              <FormField
                name="apiVersion"
                render={({ field }) => (
                  <Input
                    label={t('azure.apiVersion.label')}
                    placeholder={t('azure.apiVersion.placeholder')}
                    fullWidth
                    {...field}
                  />
                )}
              ></FormField>
            </>
          )}
          <TestConnectionButton />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}
