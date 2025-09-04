'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  Typography,
  useForm,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi, webApiQueryKeys } from '$web/client';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';
import type { developmentServersContracts } from '$web/web-api/contracts';

interface DeleteDevelopmentServerDialogProps {
  onSuccess?: VoidFunction;
  trigger: React.ReactNode;
  developmentServerId: string;
  developmentServerName: string;
}

export function DeleteDevelopmentServerDialog(
  props: DeleteDevelopmentServerDialogProps,
) {
  const {
    onSuccess,
    trigger,
    developmentServerName: name,
    developmentServerId,
  } = props;
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const t = useTranslations('development-servers/page');

  const DeleteDevelopmentServerDialogFormSchema = useMemo(
    () =>
      z.object({
        serverName: z.literal(name, {
          message: t('DeleteDevelopmentServerDialog.nameError'),
        }),
      }),
    [name, t],
  );

  const form = useForm<z.infer<typeof DeleteDevelopmentServerDialogFormSchema>>(
    {
      resolver: zodResolver(DeleteDevelopmentServerDialogFormSchema),
      defaultValues: {
        serverName: '',
      },
    },
  );

  const { mutate, isPending, isSuccess, isError } =
    webApi.developmentServers.deleteDevelopmentServer.useMutation({
      onSuccess: () => {
        // Update the development servers list by removing the deleted server
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof developmentServersContracts.getDevelopmentServers,
            200
          >
        >(
          {
            exact: true,
            queryKey: webApiQueryKeys.developmentServers.getDevelopmentServers,
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
                  (server) => server.id !== developmentServerId,
                ),
              },
            };
          },
        );

        // Close the dialog
        setIsOpen(false);

        // Call the onSuccess callback if provided
        if (onSuccess) {
          onSuccess();
        } else {
          // If no onSuccess callback, navigate to the development servers list
          window.location.href = '/development-servers';
        }
      },
    });

  const handleSubmit = useCallback(() => {
    mutate({
      params: {
        developmentServerId,
      },
    });
  }, [mutate, developmentServerId]);

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        trigger={trigger}
        errorMessage={
          isError ? t('DeleteDevelopmentServerDialog.error') : undefined
        }
        confirmColor="destructive"
        confirmText={t('DeleteDevelopmentServerDialog.confirm')}
        title={t('DeleteDevelopmentServerDialog.title')}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending || isSuccess}
      >
        <Typography>
          {t('DeleteDevelopmentServerDialog.description')}
        </Typography>
        <Typography>
          {t.rich('DeleteDevelopmentServerDialog.confirmText', {
            serverName: name,
            strong: (chunks) => (
              <Typography overrideEl="span" bold>
                {chunks}
              </Typography>
            ),
          })}
        </Typography>
        <FormField
          name="serverName"
          render={({ field }) => (
            <Input
              fullWidth
              placeholder={name}
              label={t('DeleteDevelopmentServerDialog.confirmTextLabel')}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}
