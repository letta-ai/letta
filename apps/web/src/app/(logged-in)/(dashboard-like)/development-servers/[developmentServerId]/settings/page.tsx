'use client';
import React, { useCallback } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  Form,
  FormField,
  FormProvider,
  HR,
  Input,
  LoadingEmptyStatusComponent,
  useForm,
} from '@letta-cloud/ui-component-library';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import type { developmentServersContracts } from '$web/web-api/contracts';
import { DeleteDevelopmentServerView } from './DeleteDevelopmentServerView';

const UpdateDevelopmentServerSchema = z.object({
  name: z.string().min(3).max(50),
  password: z.string(),
  url: z.string().url(),
});

type UpdateDevelopmentServerFormValues = z.infer<
  typeof UpdateDevelopmentServerSchema
>;

interface UpdateDevelopmentServerFormProps {
  developmentServer: {
    id: string;
    name: string;
    password: string;
    url: string;
  };
}

function UpdateDevelopmentServerForm(props: UpdateDevelopmentServerFormProps) {
  const { developmentServer } = props;
  const queryClient = useQueryClient();
  const t = useTranslations('development-servers/page');

  const form = useForm<UpdateDevelopmentServerFormValues>({
    resolver: zodResolver(UpdateDevelopmentServerSchema),
    defaultValues: {
      name: developmentServer.name,
      password: developmentServer.password,
      url: developmentServer.url,
    },
  });

  const { mutate, isPending } =
    webApi.developmentServers.updateDevelopmentServer.useMutation({
      onSuccess: (_res, values) => {
        // Update the individual development server query
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof developmentServersContracts.getDevelopmentServer,
            200
          >
        >(
          {
            queryKey: webApiQueryKeys.developmentServers.getDevelopmentServer(
              developmentServer.id,
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
          },
        );

        // Update the development servers list query
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof developmentServersContracts.getDevelopmentServers,
            200
          >
        >(
          {
            queryKey: webApiQueryKeys.developmentServers.getDevelopmentServers,
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
                    if (server.id === developmentServer.id) {
                      return {
                        ...server,
                        name: values.body?.name || server.name,
                        password: values.body?.password || server.password,
                        url: values.body?.url || server.url,
                      };
                    }

                    return server;
                  },
                ),
              },
            };
          },
        );
      },
    });

  const handleSubmit = useCallback(
    (data: UpdateDevelopmentServerFormValues) => {
      mutate({
        params: {
          developmentServerId: developmentServer.id,
        },
        body: {
          name: data.name,
          password: data.password,
          url: data.url,
        },
      });
    },
    [mutate, developmentServer.id],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)} variant="contained">
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              label={t('UpdateDevelopmentServerDetailsDialog.name.label')}
              {...field}
            />
          )}
        />
        <FormField
          name="password"
          render={({ field }) => (
            <Input
              showVisibilityControls
              fullWidth
              label={t('UpdateDevelopmentServerDetailsDialog.password.label')}
              {...field}
            />
          )}
        />
        <FormField
          name="url"
          render={({ field }) => (
            <Input
              fullWidth
              label={t('UpdateDevelopmentServerDetailsDialog.url.label')}
              {...field}
            />
          )}
        />
        <div>
          <Button
            color="primary"
            type="submit"
            label={t('UpdateDevelopmentServerDetailsDialog.confirm')}
            busy={isPending}
          />
        </div>
      </Form>
    </FormProvider>
  );
}

export default function DevelopmentServerSettingsPage() {
  const t = useTranslations('development-servers/dashboard/settings');

  const { developmentServerId } = useParams<{ developmentServerId: string }>();

  const { data: currentServer } =
    webApi.developmentServers.getDevelopmentServer.useQuery({
      queryData: {
        params: {
          developmentServerId,
        },
      },
      queryKey:
        webApiQueryKeys.developmentServers.getDevelopmentServer(
          developmentServerId,
        ),
    });

  return (
    <DashboardPageLayout
      headerBottomPadding="large"
      cappedWidth
      title={t('title')}
    >
      <DashboardPageSection>
        {!currentServer ? (
          <LoadingEmptyStatusComponent emptyMessage="" isLoading />
        ) : (
          <>
            <UpdateDevelopmentServerForm
              developmentServer={{
                id: currentServer.body.developmentServer.id,
                name: currentServer.body.developmentServer.name,
                password: currentServer.body.developmentServer.password || '',
                url: currentServer.body.developmentServer.url,
              }}
            />
            <HR />
            <DeleteDevelopmentServerView
              developmentServerId={currentServer.body.developmentServer.id}
              developmentServerName={currentServer.body.developmentServer.name}
            />
          </>
        )}
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}
