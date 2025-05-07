import {
  brandKeyToLogo,
  brandKeyToName,
  Dialog,
  FormField,
  FormProvider,
  Input,
  InputContainer,
  TabGroup,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import type { ListProvidersResponse } from '@letta-cloud/sdk-core';
import {
  isAPIError,
  useProvidersServiceCreateProvider,
  UseProvidersServiceListProvidersKeyFn,
} from '@letta-cloud/sdk-core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getUseProvidersServiceModelsStandardArgs } from '../utils/getUseProvidersServiceModelsStandardArgs/getUseProvidersServiceModelsStandardArgs';

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
        </VStack>
      </Dialog>
    </FormProvider>
  );
}
