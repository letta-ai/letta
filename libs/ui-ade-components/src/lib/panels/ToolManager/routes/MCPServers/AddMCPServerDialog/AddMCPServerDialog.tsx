import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import {
  Button,
  CodeEditor,
  Dialog,
  Form,
  FormActions,
  FormField,
  FormProvider,
  Input,
  RawInputContainer,
  TabGroup,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  type ListMcpServersResponse,
  type MCPServerType,
  useToolsServiceAddMcpServer,
  UseToolsServiceListMcpServersKeyFn,
} from '@letta-cloud/sdk-core';
import { useCurrentAgentMetaData } from '../../../../../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';

const AUTH_HEADER = 'Authorization';
const AUTH_TOKEN_BEARER_PREFIX = 'Bearer';

interface AddStdioServerFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

function AddStdioServerForm(props: AddStdioServerFormProps) {
  const { onCancel, onSuccess } = props;

  const t = useTranslations('ToolsEditor/MCPServers');

  const AddStdioServerSchema = useMemo(
    () =>
      z.object({
        name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
          message: t('AddServerDialog.name.error'),
        }),
        command: z.string().min(1),
        args: z.string().min(1),
      }),
    [t],
  );

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
  const { mutate, isPending, isError, reset } = useToolsServiceAddMcpServer({
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
          type: 'stdio',
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
          <FormField
            name="name"
            render={({ field }) => (
              <Input
                fullWidth
                {...field}
                placeholder={t('AddServerDialog.name.placeholder')}
                label={t('AddServerDialog.name.label')}
                infoTooltip={{ text: t('AddServerDialog.name.description') }}
              />
            )}
          />
          <FormField
            name="command"
            render={({ field }) => (
              <CodeEditor
                label={t('AddServerDialog.command.label')}
                fullWidth
                fontSize="small"
                onSetCode={field.onChange}
                showLineNumbers={false}
                language="bash"
                code={field.value}
                placeholder={t('AddServerDialog.command.placeholder')}
              />
            )}
          />
          <FormField
            name="args"
            render={({ field }) => (
              <CodeEditor
                label={t('AddServerDialog.args.label')}
                fullWidth
                fontSize="small"
                onSetCode={field.onChange}
                showLineNumbers={false}
                language="bash"
                code={field.value}
                placeholder={t('AddServerDialog.args.placeholder')}
              />
            )}
          />
          <FormActions
            errorMessage={isError ? t('AddServerDialog.error') : undefined}
          >
            <Button
              type="button"
              color="tertiary"
              label={t('AddServerDialog.cancel')}
              onClick={handleReset}
            />
            <Button
              type="submit"
              label={t('AddServerDialog.submit')}
              busy={isPending}
            />
          </FormActions>
        </VStack>
      </Form>
    </FormProvider>
  );
}

function AddSSEServerForm(props: AddStdioServerFormProps) {
  const { onCancel, onSuccess } = props;

  const t = useTranslations('ToolsEditor/MCPServers');

  const AddSSEServerSchema = useMemo(
    () =>
      z.object({
        name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
          message: t('AddServerDialog.name.error'),
        }),
        serverUrl: z.string().min(1),
        authToken: z.string().optional(),
      }),
    [t],
  );

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
  const { mutate, isPending, isError, reset } = useToolsServiceAddMcpServer({
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
          type: 'sse',
          server_url: values.serverUrl,
          auth_header: values.authToken ? AUTH_HEADER : undefined,
          auth_token: values.authToken
            ? `${AUTH_TOKEN_BEARER_PREFIX} ${values.authToken}`
            : undefined,
        },
      });
    },
    [mutate],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack gap="form" paddingBottom>
          <FormField
            name="name"
            render={({ field }) => (
              <Input
                fullWidth
                {...field}
                placeholder={t('AddServerDialog.name.placeholder')}
                label={t('AddServerDialog.name.label')}
                infoTooltip={{ text: t('AddServerDialog.name.description') }}
              />
            )}
          />
          <FormField
            name="serverUrl"
            render={({ field }) => (
              <Input
                fullWidth
                {...field}
                label={t('AddServerDialog.serverUrl.label')}
                placeholder={t('AddServerDialog.serverUrl.placeholder')}
                infoTooltip={{
                  text: t('AddServerDialog.serverUrl.description'),
                }}
              />
            )}
          />
          <FormField
            name="authToken"
            render={({ field }) => (
              <Input
                fullWidth
                {...field}
                type="password"
                label={t('AddServerDialog.authToken.label')}
                placeholder={t('AddServerDialog.authToken.placeholder')}
                infoTooltip={{
                  text: t('AddServerDialog.authToken.description'),
                }}
              />
            )}
          />
          <FormActions
            errorMessage={isError ? t('AddServerDialog.error') : undefined}
          >
            <Button
              type="button"
              label={t('AddServerDialog.cancel')}
              onClick={handleReset}
              color="tertiary"
            />
            <Button
              type="submit"
              label={t('AddServerDialog.submit')}
              busy={isPending}
            />
          </FormActions>
        </VStack>
      </Form>
    </FormProvider>
  );
}

function AddStreamableHttpServerForm(props: AddStdioServerFormProps) {
  const { onCancel, onSuccess } = props;

  const t = useTranslations('ToolsEditor/MCPServers');

  const AddStreamableHttpServerSchema = useMemo(
    () =>
      z.object({
        name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
          message: t('AddServerDialog.name.error'),
        }),
        serverUrl: z
          .string()
          .min(1, 'Server URL is required')
          .refine(
            (url) => {
              // Allow both full URLs and path formats
              return (
                url.includes('/') ||
                url.startsWith('http://') ||
                url.startsWith('https://')
              );
            },
            {
              message:
                'Please enter a valid URL or path (e.g., "example/mcp" or "https://example.com/mcp")',
            },
          ),
        authToken: z.string().optional(),
      }),
    [t],
  );

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
  const { mutate, isPending, isError, reset } = useToolsServiceAddMcpServer({
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
          type: 'streamable_http',
          server_url: values.serverUrl,
          auth_header: values.authToken ? AUTH_HEADER : undefined,
          auth_token: values.authToken
            ? `${AUTH_TOKEN_BEARER_PREFIX} ${values.authToken}`
            : undefined,
        },
      });
    },
    [mutate],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack gap="form" paddingBottom>
          <FormField
            name="name"
            render={({ field }) => (
              <Input
                fullWidth
                {...field}
                placeholder={t('AddServerDialog.name.placeholder')}
                label={t('AddServerDialog.name.label')}
                infoTooltip={{ text: t('AddServerDialog.name.description') }}
              />
            )}
          />
          <FormField
            name="serverUrl"
            render={({ field }) => (
              <Input
                fullWidth
                {...field}
                label={t('AddServerDialog.serverUrl.label')}
                placeholder={t('AddServerDialog.serverUrl.placeholder')}
                infoTooltip={{
                  text: t('AddServerDialog.serverUrl.description'),
                }}
              />
            )}
          />
          <FormField
            name="authToken"
            render={({ field }) => (
              <Input
                fullWidth
                {...field}
                type="password"
                label={t('AddServerDialog.authToken.label')}
                placeholder={t('AddServerDialog.authToken.placeholder')}
                infoTooltip={{
                  text: t('AddServerDialog.authToken.description'),
                }}
              />
            )}
          />
          <FormActions
            errorMessage={isError ? t('AddServerDialog.error') : undefined}
          >
            <Button
              type="button"
              label={t('AddServerDialog.cancel')}
              onClick={handleReset}
              color="tertiary"
            />
            <Button
              type="submit"
              label={t('AddServerDialog.submit')}
              busy={isPending}
            />
          </FormActions>
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
  const [serverType, setServerType] = useState<MCPServerType>('sse');

  const t = useTranslations('ToolsEditor/MCPServers');

  const options = useMemo(() => {
    return [
      { label: t('AddServerDialog.type.options.sse'), value: 'sse' },
      {
        label: t('AddServerDialog.type.options.streamable_http'),
        value: 'streamable_http',
      },
      ...(isLocal
        ? [{ label: t('AddServerDialog.type.options.stdio'), value: 'stdio' }]
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
        {serverType === 'stdio' ? (
          <AddStdioServerForm
            onSuccess={() => {
              setIsOpen(false);
            }}
            onCancel={() => {
              setIsOpen(false);
            }}
          />
        ) : serverType === 'streamable_http' ? (
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
