import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useState } from 'react';
import type { z } from 'zod';
import {
  Dialog,
  Form,
  FormProvider,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  type ListMcpServersResponse,
  type SSEServerConfig,
  type StreamableHTTPServerConfig,
  useToolsServiceUpdateMcpServer,
  UseToolsServiceListMcpServersKeyFn,
} from '@letta-cloud/sdk-core';
import { MCPServerTypes } from '../types';
import { parseAuthToken } from '../utils';
import {
  ServerNameField,
  ServerUrlField,
  AuthTokenField,
  MCPFormActions,
} from '../FormFields';
import {
  useSSEServerSchema,
  useStreamableHttpServerSchema,
  useMCPErrorMessage,
} from '../hooks';

interface BaseUpdateServerFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

interface UpdateSSEServerFormProps extends BaseUpdateServerFormProps {
  server: SSEServerConfig;
}

interface UpdateStreamableHttpServerFormProps
  extends BaseUpdateServerFormProps {
  server: StreamableHTTPServerConfig;
}

function UpdateSSEServerForm(props: UpdateSSEServerFormProps) {
  const { server, onCancel, onSuccess } = props;

  const UpdateSSEServerSchema = useSSEServerSchema();
  const getErrorMessage = useMCPErrorMessage();

  type UpdateSSEServerFormValues = z.infer<typeof UpdateSSEServerSchema>;

  const form = useForm<UpdateSSEServerFormValues>({
    resolver: zodResolver(UpdateSSEServerSchema),
    defaultValues: {
      name: server.server_name,
      serverUrl: server.server_url,
      authToken: parseAuthToken(server.auth_token),
    },
  });

  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, reset } =
    useToolsServiceUpdateMcpServer({
      onSuccess: (updatedServer) => {
        queryClient.setQueriesData<ListMcpServersResponse | undefined>(
          {
            queryKey: UseToolsServiceListMcpServersKeyFn(),
          },
          (data) => {
            if (!data) return data;
            return {
              ...data,
              [updatedServer.server_name]: updatedServer,
            };
          },
        );

        onSuccess();
      },
    });

  const handleReset = useCallback(() => {
    form.reset();
    reset();
    onCancel();
  }, [form, reset, onCancel]);

  const handleSubmit = useCallback(
    (values: UpdateSSEServerFormValues) => {
      mutate({
        mcpServerName: server.server_name,
        requestBody: {
          server_url: values.serverUrl,
          token: values.authToken || undefined,
        },
      });
    },
    [mutate, server.server_name],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack gap="form" paddingBottom>
          <ServerNameField disabled />
          <ServerUrlField />
          <AuthTokenField isUpdate />
          <MCPFormActions
            errorMessage={isError ? getErrorMessage(error, false) : undefined}
            onCancel={handleReset}
            isPending={isPending}
            isUpdate
          />
        </VStack>
      </Form>
    </FormProvider>
  );
}

function UpdateStreamableHttpServerForm(
  props: UpdateStreamableHttpServerFormProps,
) {
  const { server, onCancel, onSuccess } = props;

  const UpdateStreamableHttpServerSchema = useStreamableHttpServerSchema();
  const getErrorMessage = useMCPErrorMessage();

  type UpdateStreamableHttpServerFormValues = z.infer<
    typeof UpdateStreamableHttpServerSchema
  >;

  const form = useForm<UpdateStreamableHttpServerFormValues>({
    resolver: zodResolver(UpdateStreamableHttpServerSchema),
    defaultValues: {
      name: server.server_name,
      serverUrl: server.server_url,
      authToken: parseAuthToken(server.auth_token),
    },
  });

  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, reset } =
    useToolsServiceUpdateMcpServer({
      onSuccess: (updatedServer) => {
        queryClient.setQueriesData<ListMcpServersResponse | undefined>(
          {
            queryKey: UseToolsServiceListMcpServersKeyFn(),
          },
          (data) => {
            if (!data) return data;
            return {
              ...data,
              [updatedServer.server_name]: updatedServer,
            };
          },
        );

        onSuccess();
      },
    });

  const handleReset = useCallback(() => {
    form.reset();
    reset();
    onCancel();
  }, [form, reset, onCancel]);

  const handleSubmit = useCallback(
    (values: UpdateStreamableHttpServerFormValues) => {
      mutate({
        mcpServerName: server.server_name,
        requestBody: {
          server_url: values.serverUrl,
          token: values.authToken || undefined,
        },
      });
    },
    [mutate, server.server_name],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack gap="form" paddingBottom>
          <ServerNameField disabled />
          <ServerUrlField />
          <AuthTokenField isUpdate />
          <MCPFormActions
            errorMessage={isError ? getErrorMessage(error, false) : undefined}
            onCancel={handleReset}
            isPending={isPending}
            isUpdate
          />
        </VStack>
      </Form>
    </FormProvider>
  );
}

interface UpdateMCPServerDialogProps {
  trigger: React.ReactNode;
  server: SSEServerConfig | StreamableHTTPServerConfig;
}

export function UpdateMCPServerDialog(props: UpdateMCPServerDialogProps) {
  const { trigger, server } = props;
  const [isOpen, setIsOpen] = useState(false);

  const t = useTranslations('ToolsEditor/MCPServers');

  return (
    <Dialog
      trigger={trigger}
      onOpenChange={setIsOpen}
      isOpen={isOpen}
      hideFooter
      title={t('UpdateServerDialog.title')}
      disableForm
    >
      <VStack gap="form">
        {server.type === MCPServerTypes.StreamableHttp ? (
          <UpdateStreamableHttpServerForm
            server={server}
            onSuccess={() => {
              setIsOpen(false);
            }}
            onCancel={() => {
              setIsOpen(false);
            }}
          />
        ) : (
          <UpdateSSEServerForm
            server={server}
            onSuccess={() => {
              setIsOpen(false);
            }}
            onCancel={() => {
              setIsOpen(false);
            }}
          />
        )}
      </VStack>
    </Dialog>
  );
}
