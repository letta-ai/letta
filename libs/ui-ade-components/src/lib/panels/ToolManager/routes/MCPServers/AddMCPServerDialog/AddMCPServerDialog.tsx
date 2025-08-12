'use client';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo, useState } from 'react';
import type { z } from 'zod';
import {
  Dialog,
  Form,
  FormProvider,
  RawInputContainer,
  TabGroup,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  type ListMcpServersResponse,
  useToolsServiceAddMcpServer,
  UseToolsServiceListMcpServersKeyFn,
} from '@letta-cloud/sdk-core';
import { type MCPServerType, MCPServerTypes } from '../types';
import { useCurrentAgentMetaData } from '../../../../../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import {
  parseAuthenticationData,
  parseArgsString,
  parseEnvironmentArray,
} from '../utils';
import { ConfigSection } from './ConfigSection';
import { useConfigHandler } from './configUtils';
import { AuthModes } from '../AuthenticationSection';
import {
  ServerNameField,
  ServerUrlField,
  MCPFormActions,
  CommandField,
  ArgsField,
  AuthenticationSection,
  EnvironmentField,
} from '../FormFields';
import { TestMCPConnectionButton } from '../TestMCPConnectionButton';
import {
  useStdioServerSchema,
  useSSEServerSchema,
  useStreamableHttpServerSchema,
  useMCPErrorMessage,
} from '../hooks';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useADEAppContext } from '../../../../../AppContext/AppContext';

interface AddStdioServerFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export function generateServerName(
  baseName: string,
  existingServers: ListMcpServersResponse | undefined,
) {
  if (!existingServers) {
    return baseName;
  }

  // Check if this is the first server with this base name
  const similarServers = Object.values(existingServers).filter((server) =>
    server.server_name.startsWith(baseName),
  );

  if (similarServers.length === 0) {
    return baseName;
  }

  // If there are existing servers, add a number
  return `${baseName} ${similarServers.length}`;
}

function AddStdioServerForm(props: AddStdioServerFormProps) {
  const { onCancel, onSuccess } = props;
  const [configValue, setConfigValue] = useState('');
  const { agentId } = useCurrentAgentMetaData()
  const { user } = useADEAppContext()

  const AddStdioServerSchema = useStdioServerSchema();
  const getErrorMessage = useMCPErrorMessage();

  type AddStdioServerFormValues = z.infer<typeof AddStdioServerSchema>;

  const form = useForm<AddStdioServerFormValues>({
    resolver: zodResolver(AddStdioServerSchema),
    defaultValues: {
      name: '',
      command: '',
      args: '',
      environment: undefined,
    },
  });

  const queryClient = useQueryClient();
  const { mutate, isPending, isError, error, reset } =
    useToolsServiceAddMcpServer({
      onSuccess: (response) => {
        queryClient.setQueriesData<ListMcpServersResponse | undefined>(
          {
            queryKey: UseToolsServiceListMcpServersKeyFn(),
          },
          () => {
            return response.reduce((acc, item) => {
              acc[item.server_name] = item;
              return acc;
            }, {} as ListMcpServersResponse);
          },
        );

        onSuccess();
      },
    });

  const handleReset = useCallback(() => {
    form.reset();
    reset();
    setConfigValue('');
    onCancel();
  }, [form, reset, onCancel]);

  const handleConfigChange = useConfigHandler({
    form,
    serverType: MCPServerTypes.Stdio,
    setConfigValue,
  });

  const handleSubmit = useCallback(
    (values: AddStdioServerFormValues) => {
      const env = parseEnvironmentArray(values.environment);

      trackClientSideEvent(AnalyticsEvent.ADD_MCP_SERVER_TO_AGENT, {
        userId: user?.id || '',
        agentId,
        mcpServerName: values.name,
        mcpServerType: MCPServerTypes.Stdio
      })

      mutate({
        requestBody: {
          server_name: values.name,
          type: MCPServerTypes.Stdio,
          command: values.command,
          args: parseArgsString(values.args),
          env: Object.keys(env).length > 0 ? env : null, // Only include env if it's not empty
        },
      });
    },
    [mutate, user?.id, agentId],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack paddingBottom gap="form">
          <ServerNameField />
          <CommandField />
          <ArgsField />
          <EnvironmentField />
          <ConfigSection
            configValue={configValue}
            onChange={handleConfigChange}
            isOpen
          />
          <TestMCPConnectionButton serverType={MCPServerTypes.Stdio} />
          <MCPFormActions
            errorMessage={isError ? getErrorMessage(error) : undefined}
            onCancel={handleReset}
            isPending={isPending}
          />
        </VStack>
      </Form>
    </FormProvider>
  );
}

function AddSSEServerForm(props: AddStdioServerFormProps) {
  const { onCancel, onSuccess } = props;
  const [configValue, setConfigValue] = useState('');
  const { agentId } = useCurrentAgentMetaData()
  const { user } = useADEAppContext()

  const AddSSEServerSchema = useSSEServerSchema();
  const getErrorMessage = useMCPErrorMessage();

  type AddSSEServerFormValues = z.infer<typeof AddSSEServerSchema>;

  const form = useForm<AddSSEServerFormValues>({
    resolver: zodResolver(AddSSEServerSchema),
    defaultValues: {
      name: '',
      serverUrl: '',
      authMode: AuthModes.NONE,
      authToken: '',
      customHeaders: [{ key: '', value: '' }],
    },
  });

  const queryClient = useQueryClient();
  const { mutate, isPending, isError, error, reset } =
    useToolsServiceAddMcpServer({
      onSuccess: (response) => {
        queryClient.setQueriesData<ListMcpServersResponse | undefined>(
          {
            queryKey: UseToolsServiceListMcpServersKeyFn(),
          },
          () => {
            return response.reduce((acc, item) => {
              acc[item.server_name] = item;
              return acc;
            }, {} as ListMcpServersResponse);
          },
        );

        onSuccess();
      },
    });

  const handleReset = useCallback(() => {
    form.reset();
    reset();
    setConfigValue('');
    onCancel();
  }, [form, reset, onCancel]);

  const handleConfigChange = useConfigHandler({
    form,
    serverType: MCPServerTypes.Sse,
    setConfigValue,
  });

  const handleSubmit = useCallback(
    (values: AddSSEServerFormValues) => {
      const { authHeaders, authHeader, authToken } = parseAuthenticationData({
        authMode: values.authMode,
        authToken: values.authToken,
        customHeaders: values.customHeaders,
        options: { formatToken: true, includeAuthHeader: true },
      });

      trackClientSideEvent(AnalyticsEvent.ADD_MCP_SERVER_TO_AGENT, {
        userId: user?.id || '',
        agentId,
        mcpServerName: values.name,
        mcpServerType: MCPServerTypes.Sse
      })

      mutate({
        requestBody: {
          server_name: values.name,
          type: MCPServerTypes.Sse,
          server_url: values.serverUrl,
          auth_header: authHeader,
          auth_token: authToken,
          custom_headers: authHeaders,
        },
      });
    },
    [mutate, agentId, user?.id],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack gap="form" paddingBottom>
          <ServerNameField />
          <ServerUrlField />
          <AuthenticationSection />
          <ConfigSection
            configValue={configValue}
            onChange={handleConfigChange}
          />
          <TestMCPConnectionButton serverType={MCPServerTypes.Sse} />
          <MCPFormActions
            errorMessage={isError ? getErrorMessage(error) : undefined}
            onCancel={handleReset}
            isPending={isPending}
          />
        </VStack>
      </Form>
    </FormProvider>
  );
}

function AddStreamableHttpServerForm(props: AddStdioServerFormProps) {
  const { onCancel, onSuccess } = props;
  const [configValue, setConfigValue] = useState('');
  const { user } = useADEAppContext()
  const { agentId } = useCurrentAgentMetaData()

  const AddStreamableHttpServerSchema = useStreamableHttpServerSchema();
  const getErrorMessage = useMCPErrorMessage();

  type AddStreamableHttpServerFormValues = z.infer<
    typeof AddStreamableHttpServerSchema
  >;

  const form = useForm<AddStreamableHttpServerFormValues>({
    resolver: zodResolver(AddStreamableHttpServerSchema),
    defaultValues: {
      name: '',
      serverUrl: '',
      authMode: AuthModes.NONE,
      authToken: '',
      customHeaders: [{ key: '', value: '' }],
    },
  });

  const queryClient = useQueryClient();
  const { mutate, isPending, isError, error, reset } =
    useToolsServiceAddMcpServer({
      onSuccess: (response) => {
        queryClient.setQueriesData<ListMcpServersResponse | undefined>(
          {
            queryKey: UseToolsServiceListMcpServersKeyFn(),
          },
          () => {
            return response.reduce((acc, item) => {
              acc[item.server_name] = item;
              return acc;
            }, {} as ListMcpServersResponse);
          },
        );

        onSuccess();
      },
    });

  const handleReset = useCallback(() => {
    form.reset();
    reset();
    setConfigValue('');
    onCancel();
  }, [form, reset, onCancel]);

  const handleConfigChange = useConfigHandler({
    form,
    serverType: MCPServerTypes.StreamableHttp,
    setConfigValue,
  });

  const handleSubmit = useCallback(
    (values: AddStreamableHttpServerFormValues) => {
      const { authHeaders, authHeader, authToken } = parseAuthenticationData({
        authMode: values.authMode,
        authToken: values.authToken,
        customHeaders: values.customHeaders,
        options: { formatToken: true, includeAuthHeader: true },
      });

      trackClientSideEvent(AnalyticsEvent.ADD_MCP_SERVER_TO_AGENT, {
        userId: user?.id || '',
        agentId,
        mcpServerName: values.name,
        mcpServerType: MCPServerTypes.StreamableHttp
      })

      mutate({
        requestBody: {
          server_name: values.name,
          type: MCPServerTypes.StreamableHttp,
          server_url: values.serverUrl,
          auth_header: authHeader,
          auth_token: authToken,
          custom_headers: authHeaders,
        },
      });
    },
    [agentId, mutate, user?.id],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack gap="form" paddingBottom>
          <ServerNameField />
          <ServerUrlField />
          <AuthenticationSection />
          <ConfigSection
            configValue={configValue}
            onChange={handleConfigChange}
          />
          <TestMCPConnectionButton serverType={MCPServerTypes.StreamableHttp} />
          <MCPFormActions
            errorMessage={isError ? getErrorMessage(error) : undefined}
            onCancel={handleReset}
            isPending={isPending}
          />
        </VStack>
      </Form>
    </FormProvider>
  );
}

interface AddServerDialogProps {
  trigger: React.ReactNode;
}

export function AddServerDialog(props: AddServerDialogProps) {
  const { trigger } = props;
  const [isOpen, setIsOpen] = useState(false);

  const { isLocal } = useCurrentAgentMetaData();
  const [serverType, setServerType] = useState<MCPServerType>(
    MCPServerTypes.StreamableHttp,
  );

  const t = useTranslations('ToolsEditor/MCPServers');

  const options = useMemo(() => {
    return [
      {
        label: t('AddServerDialog.type.options.streamable_http'),
        value: MCPServerTypes.StreamableHttp,
      },
      {
        label: t('AddServerDialog.type.options.sse'),
        value: MCPServerTypes.Sse,
      },
      ...(isLocal
        ? [
            {
              label: t('AddServerDialog.type.options.stdio'),
              value: MCPServerTypes.Stdio,
            },
          ]
        : []),
    ];
  }, [t, isLocal]);

  const selectedOption = useMemo(() => {
    return options.find((option) => option.value === serverType);
  }, [options, serverType]);

  return (
    <Dialog
      trigger={trigger}
      onOpenChange={setIsOpen}
      isOpen={isOpen}
      hideFooter
      title={t('AddServerDialog.title')}
      disableForm
      size="large"
    >
      <VStack gap="form">
        {options.length > 1 && (
          <RawInputContainer label={t('AddServerDialog.type.label')}>
            <TabGroup
              color="dark"
              extendBorder
              variant="chips"
              items={options}
              value={selectedOption?.value}
              onValueChange={(option) => {
                setServerType(option as MCPServerType);
              }}
            />
          </RawInputContainer>
        )}
        {serverType === MCPServerTypes.Stdio ? (
          <AddStdioServerForm
            onSuccess={() => {
              setIsOpen(false);
            }}
            onCancel={() => {
              setIsOpen(false);
            }}
          />
        ) : serverType === MCPServerTypes.StreamableHttp ? (
          <AddStreamableHttpServerForm
            onSuccess={() => {
              setIsOpen(false);
            }}
            onCancel={() => {
              setIsOpen(false);
            }}
          />
        ) : (
          <AddSSEServerForm
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
