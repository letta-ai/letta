'use client';
import React, { useCallback, useMemo } from 'react';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface ConnectToSelfHostedProjectDialogProps {
  trigger: React.ReactNode;
}

export function ConnectToSelfHostedProjectDialog(
  props: ConnectToSelfHostedProjectDialogProps,
) {
  const { trigger } = props;
  const [isOpen, setIsOpen] = React.useState(false);
  const t = useTranslations('projects/page/SelfHostedProjectsList');
  const queryClient = useQueryClient();

  const developmentServerFormSchema = z.object({
    name: z
      .string()
      .min(3, {
        message: t('createDevelopmentServerDialog.validation.nameMinLength'),
      })
      .max(50, {
        message: t('createDevelopmentServerDialog.validation.nameMaxLength'),
      }),
    url: z.string().url({
      message: t('createDevelopmentServerDialog.validation.urlInvalid'),
    }),
    password: z.string().optional(),
  });

  type DevelopmentServerFormValues = z.infer<
    typeof developmentServerFormSchema
  >;

  const form = useForm<DevelopmentServerFormValues>({
    resolver: zodResolver(developmentServerFormSchema),
    defaultValues: {
      name: '',
      url: '',
      password: '',
    },
  });

  const {
    mutate: createDevelopmentServer,
    isPending,
    error,
    reset,
  } = webApi.developmentServers.createDevelopmentServer.useMutation();

  const handleOpenChange = useCallback(
    (nextState: boolean) => {
      setIsOpen(nextState);
      if (!nextState) {
        form.reset();
        reset();
      }
    },
    [form, reset],
  );

  const errorMessage = useMemo(() => {
    if (error) {
      return t('createDevelopmentServerDialog.errors.default');
    }
    return '';
  }, [error, t]);

  const handleSubmit = useCallback(
    (values: DevelopmentServerFormValues) => {
      createDevelopmentServer(
        {
          body: {
            name: values.name.trim(),
            url: values.url.trim(),
            password: values.password || '',
          },
        },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey:
                webApiQueryKeys.developmentServers.getDevelopmentServers,
            });
            handleOpenChange(false);
          },
        },
      );
    },
    [createDevelopmentServer, queryClient, handleOpenChange],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('createDevelopmentServerDialog.title')}
        errorMessage={errorMessage}
        isConfirmBusy={isPending}
        onOpenChange={handleOpenChange}
        isOpen={isOpen}
        trigger={trigger}
      >
        <VStack gap="form">
          <FormField
            name="name"
            render={({ field }) => (
              <Input
                {...field}
                fullWidth
                label={t('createDevelopmentServerDialog.nameLabel')}
                placeholder={t('createDevelopmentServerDialog.namePlaceholder')}
              />
            )}
          />

          <FormField
            name="url"
            render={({ field }) => (
              <Input
                {...field}
                fullWidth
                label={t('createDevelopmentServerDialog.urlLabel')}
                placeholder={t('createDevelopmentServerDialog.urlPlaceholder')}
              />
            )}
          />

          <FormField
            name="password"
            render={({ field }) => (
              <Input
                {...field}
                fullWidth
                type="password"
                label={t('createDevelopmentServerDialog.passwordLabel')}
                placeholder={t(
                  'createDevelopmentServerDialog.passwordPlaceholder',
                )}
              />
            )}
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}
