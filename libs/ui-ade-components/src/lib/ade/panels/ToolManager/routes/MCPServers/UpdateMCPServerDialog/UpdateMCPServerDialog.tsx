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
  type StdioServerConfig,
  useToolsServiceUpdateMcpServer,
  UseToolsServiceListMcpServersKeyFn,
  UseToolsServiceListMcpToolsByServerKeyFn,
} from '@letta-cloud/sdk-core';
import { MCPServerTypes } from '../types';
import {
  parseAuthenticationData,
  getAuthModeAndValuesFromServer,
  parseArgsString,
  parseEnvironmentArray,
  environmentToArray,
} from '../utils';
import {
  ServerNameField,
  ServerUrlField,
  MCPFormActions,
  AuthenticationSection,
  CommandField,
  ArgsField,
  EnvironmentField,
} from '../FormFields';
import {
  useSSEServerSchema,
  useStreamableHttpServerSchema,
  useStdioServerSchema,
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

interface UpdateStdioServerFormProps extends BaseUpdateServerFormProps {
  server: StdioServerConfig;
}

function UpdateSSEServerForm(props: UpdateSSEServerFormProps) {
  const { server, onCancel, onSuccess } = props;

  const UpdateSSEServerSchema = useSSEServerSchema();
  const getErrorMessage = useMCPErrorMessage();

  type UpdateSSEServerFormValues = z.infer<typeof UpdateSSEServerSchema>;

  const { authMode, authToken, customHeaders } =
    getAuthModeAndValuesFromServer(server);

  const form = useForm<UpdateSSEServerFormValues>({
    resolver: zodResolver(UpdateSSEServerSchema),
    defaultValues: {
      name: server.server_name,
      serverUrl: server.server_url,
      authMode,
      authToken,
      customHeaders,
    },
  });

  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, reset } =
    useToolsServiceUpdateMcpServer({
      onSuccess: (updatedServer) => {
        // Update MCP servers list query with the updated server
        queryClient.setQueriesData<ListMcpServersResponse | undefined>(
          {
            queryKey: UseToolsServiceListMcpServersKeyFn(),
          },
          (oldData) => {
            if (!oldData) return oldData;

            // Update the specific server in the cache
            return {
              ...oldData,
              [updatedServer.server_name]: updatedServer,
            };
          },
        );

        // Invalidate tools for this specific server (since tools might have changed)
        void queryClient.invalidateQueries({
          queryKey: UseToolsServiceListMcpToolsByServerKeyFn({
            mcpServerName: updatedServer.server_name,
          }),
        });

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
      const { token, authHeaders } = parseAuthenticationData({
        authMode: values.authMode,
        authToken: values.authToken,
        customHeaders: values.customHeaders,
      });

      mutate({
        mcpServerName: server.server_name,
        requestBody: {
          server_url: values.serverUrl,
          token: token ?? null,
          custom_headers: authHeaders ?? null,
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
          <AuthenticationSection isUpdate />
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

  const { authMode, authToken, customHeaders } =
    getAuthModeAndValuesFromServer(server);

  const form = useForm<UpdateStreamableHttpServerFormValues>({
    resolver: zodResolver(UpdateStreamableHttpServerSchema),
    defaultValues: {
      name: server.server_name,
      serverUrl: server.server_url,
      authMode,
      authToken,
      customHeaders,
    },
  });

  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, reset } =
    useToolsServiceUpdateMcpServer({
      onSuccess: (updatedServer) => {
        // Invalidate tools for this specific server
        void queryClient.invalidateQueries({
          queryKey: UseToolsServiceListMcpToolsByServerKeyFn({
            mcpServerName: updatedServer.server_name,
          }),
        });

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
      const { token, authHeaders } = parseAuthenticationData({
        authMode: values.authMode,
        authToken: values.authToken,
        customHeaders: values.customHeaders,
      });

      mutate({
        mcpServerName: server.server_name,
        requestBody: {
          server_url: values.serverUrl,
          token: token ?? null,
          custom_headers: authHeaders ?? null,
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
          <AuthenticationSection isUpdate />
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

function UpdateStdioServerForm(props: UpdateStdioServerFormProps) {
  const { server, onCancel, onSuccess } = props;

  const UpdateStdioServerSchema = useStdioServerSchema();
  const getErrorMessage = useMCPErrorMessage();

  type UpdateStdioServerFormValues = z.infer<typeof UpdateStdioServerSchema>;

  const env = environmentToArray(server.env);

  const form = useForm<UpdateStdioServerFormValues>({
    resolver: zodResolver(UpdateStdioServerSchema),
    defaultValues: {
      name: server.server_name,
      command: server.command,
      args: server.args.join(', '),
      environment: env,
    },
  });

  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, reset } =
    useToolsServiceUpdateMcpServer({
      onSuccess: (updatedServer) => {
        // Update MCP servers list query with the updated server
        queryClient.setQueriesData<ListMcpServersResponse | undefined>(
          {
            queryKey: UseToolsServiceListMcpServersKeyFn(),
          },
          (oldData) => {
            if (!oldData) return oldData;

            // Update the specific server in the cache
            return {
              ...oldData,
              [updatedServer.server_name]: updatedServer,
            };
          },
        );

        // Invalidate tools for this specific server (since tools might have changed)
        void queryClient.invalidateQueries({
          queryKey: UseToolsServiceListMcpToolsByServerKeyFn({
            mcpServerName: updatedServer.server_name,
          }),
        });

        onSuccess();
      },
    });

  const handleReset = useCallback(() => {
    form.reset();
    reset();
    onCancel();
  }, [form, reset, onCancel]);

  const handleSubmit = useCallback(
    (values: UpdateStdioServerFormValues) => {
      const env = parseEnvironmentArray(values.environment);

      mutate({
        mcpServerName: server.server_name,
        requestBody: {
          stdio_config: {
            server_name: values.name,
            command: values.command,
            args: parseArgsString(values.args),
            env,
          },
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
          <CommandField />
          <ArgsField />
          <EnvironmentField />
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
  server: SSEServerConfig | StdioServerConfig | StreamableHTTPServerConfig;
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
      size="large"
    >
      <VStack gap="form">
        {server.type === MCPServerTypes.StreamableHttp ? (
          <UpdateStreamableHttpServerForm
            server={server as StreamableHTTPServerConfig}
            onSuccess={() => {
              setIsOpen(false);
            }}
            onCancel={() => {
              setIsOpen(false);
            }}
          />
        ) : server.type === MCPServerTypes.Stdio ? (
          <UpdateStdioServerForm
            server={server as StdioServerConfig}
            onSuccess={() => {
              setIsOpen(false);
            }}
            onCancel={() => {
              setIsOpen(false);
            }}
          />
        ) : (
          <UpdateSSEServerForm
            server={server as SSEServerConfig}
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
