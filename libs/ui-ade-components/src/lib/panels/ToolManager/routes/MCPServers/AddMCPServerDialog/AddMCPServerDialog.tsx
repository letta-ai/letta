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
import { AUTH_HEADER } from '../constants';
import { formatAuthToken } from '../utils';
import {
  ServerNameField,
  ServerUrlField,
  AuthTokenField,
  MCPFormActions,
  CommandField,
  ArgsField,
} from '../FormFields';
import {
  useStdioServerSchema,
  useSSEServerSchema,
  useStreamableHttpServerSchema,
  useMCPErrorMessage,
} from '../hooks';

interface AddStdioServerFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

function AddStdioServerForm(props: AddStdioServerFormProps) {
  const { onCancel, onSuccess } = props;

  const AddStdioServerSchema = useStdioServerSchema();
  const getErrorMessage = useMCPErrorMessage();

  type AddStdioServerFormValues = z.infer<typeof AddStdioServerSchema>;

  const form = useForm<AddStdioServerFormValues>({
    resolver: zodResolver(AddStdioServerSchema),
    defaultValues: {
      name: '',
      command: '',
      args: '',
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
    onCancel();
  }, [form, reset, onCancel]);

  const handleSubmit = useCallback(
    (values: AddStdioServerFormValues) => {
      mutate({
        requestBody: {
          server_name: values.name,
          type: MCPServerTypes.Stdio,
          command: values.command,
          args: values.args.split(','),
        },
      });
    },
    [mutate],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack paddingBottom gap="form">
          <ServerNameField />
          <CommandField />
          <ArgsField />
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

  const AddSSEServerSchema = useSSEServerSchema();
  const getErrorMessage = useMCPErrorMessage();

  type AddSSEServerFormValues = z.infer<typeof AddSSEServerSchema>;

  const form = useForm<AddSSEServerFormValues>({
    resolver: zodResolver(AddSSEServerSchema),
    defaultValues: {
      name: '',
      serverUrl: '',
      authToken: '',
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
    onCancel();
  }, [form, reset, onCancel]);

  const handleSubmit = useCallback(
    (values: AddSSEServerFormValues) => {
      mutate({
        requestBody: {
          server_name: values.name,
          type: MCPServerTypes.Sse,
          server_url: values.serverUrl,
          auth_header: values.authToken ? AUTH_HEADER : undefined,
          auth_token: formatAuthToken(values.authToken),
        },
      });
    },
    [mutate],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack gap="form" paddingBottom>
          <ServerNameField />
          <ServerUrlField />
          <AuthTokenField />
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
      authToken: '',
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
    onCancel();
  }, [form, reset, onCancel]);

  const handleSubmit = useCallback(
    (values: AddStreamableHttpServerFormValues) => {
      mutate({
        requestBody: {
          server_name: values.name,
          type: MCPServerTypes.StreamableHttp,
          server_url: values.serverUrl,
          auth_header: values.authToken ? AUTH_HEADER : undefined,
          auth_token: formatAuthToken(values.authToken),
        },
      });
    },
    [mutate],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack gap="form" paddingBottom>
          <ServerNameField />
          <ServerUrlField />
          <AuthTokenField />
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
    MCPServerTypes.Sse,
  );

  const t = useTranslations('ToolsEditor/MCPServers');

  const options = useMemo(() => {
    return [
      {
        label: t('AddServerDialog.type.options.sse'),
        value: MCPServerTypes.Sse,
      },
      {
        label: t('AddServerDialog.type.options.streamable_http'),
        value: MCPServerTypes.StreamableHttp,
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
    >
      <VStack gap="form">
        {options.length > 1 && (
          <RawInputContainer label={t('AddServerDialog.type.label')}>
            <TabGroup
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
