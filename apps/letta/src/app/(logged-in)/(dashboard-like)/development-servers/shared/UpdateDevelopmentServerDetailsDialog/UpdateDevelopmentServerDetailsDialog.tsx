import { z } from 'zod';
import React, { useCallback, useState } from 'react';
import { useResetAllLettaAgentsQueryKeys } from '@letta-web/letta-agents-api';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-web/component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { ServerInferResponses } from '@ts-rest/core';
import type { developmentServersContracts } from '$letta/web-api/development-servers/developmentServersContracts';

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

export function UpdateDevelopmentServerDetailsDialog(
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
