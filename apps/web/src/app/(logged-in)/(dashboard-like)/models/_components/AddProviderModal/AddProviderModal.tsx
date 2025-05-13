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

function TestConnectionButton() {
  const [isTesting, setIsTesting] = useState(false);
  const [testingStatus, setTestingStatus] = useState<
    'failed' | 'success' | null
  >(null);
  const t = useTranslations('pages/models/CreateProviderModal');

  const { watch } = useFormContext();

  const testConnection = useCallback(
    async (apiKey: string, providerType: ProviderType) => {
      try {
        setIsTesting(true);
        setTestingStatus(null);
        const res = await fetch(
          `/v1/providers/check?provider_type=${providerType}`,
          {
            method: 'GET',
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
            },
          },
        );

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
        color="secondary"
        busy={isTesting}
        label={t('TestConnectionButton.label')}
        onClick={() => {
          void testConnection(apiKey, providerType);
        }}
      />
      <HStack>
        {testingStatus === 'success' && (
          <Tooltip content={t('TestConnectionButton.success.tooltip')}>
            <HStack>
              <CheckIcon color="success" />
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
  providerType: z.enum(['anthropic', 'openai', 'google_ai']),
  name: z.string().min(1),
  apiKey: z.string().min(1),
});

type AddModelProviderSchema = z.infer<typeof AddModelProviderSchema>;

export function AddProviderModal(props: CreateProviderModalProps) {
  const { trigger } = props;
  const t = useTranslations('pages/models/CreateProviderModal');

  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useProvidersServiceCreateProvider();

  const form = useForm<AddModelProviderSchema>({
    resolver: zodResolver(AddModelProviderSchema),
    defaultValues: {
      providerType: 'openai',
      name: '',
      apiKey: '',
    },
  });

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
          },
        },
        {
          onSuccess: (response) => {
            handleOpenChange(false);
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
          },
        },
      );
    },
    [handleOpenChange, mutate, queryClient],
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
        size="medium"
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
                  items={[
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
                      label: brandKeyToName('gemini'),
                      value: 'google_ai',
                      icon: brandKeyToLogo('gemini'),
                    },
                  ]}
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
                label={t('apiKey.label')}
                placeholder="••••••••••••••••••••••"
                type="password"
                fullWidth
                showVisibilityControls
                {...field}
              />
            )}
          ></FormField>
          <TestConnectionButton />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}
