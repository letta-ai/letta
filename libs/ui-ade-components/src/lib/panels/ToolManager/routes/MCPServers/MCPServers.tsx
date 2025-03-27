import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { ToolManagerPage } from '../../components/ToolManagerPage/ToolManagerPage';
import {
  Badge,
  Button,
  ChevronDownIcon,
  Dialog,
  Form,
  FormActions,
  FormField,
  FormProvider,
  HiddenOnMobile,
  HStack,
  Input,
  LoadingEmptyStatusComponent,
  PlusIcon,
  Popover,
  RawInputContainer,
  TabGroup,
  Typography,
  useForm,
  VisibleOnMobile,
  VStack,
} from '@letta-cloud/ui-component-library';
import type {
  ListMcpServersResponse,
  MCPServerItemType,
  MCPServerType,
} from '@letta-cloud/sdk-core';
import {
  useToolsServiceAddMcpServer,
  useToolsServiceListMcpServers,
  UseToolsServiceListMcpServersKeyFn,
} from '@letta-cloud/sdk-core';
import { ToolSearchInput } from '../../components/ToolSearchInput/ToolSearchInput';
import { cn } from '@letta-cloud/ui-styles';
import { SpecificToolIcon } from '../../components/SpecificToolIcon/SpecificToolIcon';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgentMetaData } from '../../../../hooks';
import { SingleMCPServer } from './SingleMCPServer/SingleMCPServer';

interface AddStdioServerFormProps {
  onCancel: () => void;
}

function AddStdioServerForm(props: AddStdioServerFormProps) {
  const { onCancel } = props;

  const t = useTranslations('ToolsEditor/MCPServers');

  const AddStdioServerSchema = useMemo(
    () =>
      z.object({
        name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
          message: t('AddServerDialog.name.error'),
        }),
        command: z.string(),
        args: z.string(),
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
                labelVariant="simple"
                fullWidth
                {...field}
                description={t('AddServerDialog.name.description')}
                placeholder={t('AddServerDialog.name.placeholder')}
                label={t('AddServerDialog.name.label')}
              />
            )}
          />
          <FormField
            name="command"
            render={({ field }) => (
              <Input
                labelVariant="simple"
                fullWidth
                {...field}
                label={t('AddServerDialog.command.label')}
                placeholder={t('AddServerDialog.command.placeholder')}
                description={t('AddServerDialog.command.description')}
              />
            )}
          />
          <FormField
            name="args"
            render={({ field }) => (
              <Input
                labelVariant="simple"
                fullWidth
                {...field}
                label={t('AddServerDialog.args.label')}
                placeholder={t('AddServerDialog.args.placeholder')}
                description={t('AddServerDialog.args.description')}
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
  const { onCancel } = props;

  const t = useTranslations('ToolsEditor/MCPServers');

  const AddSSEServerSchema = useMemo(
    () =>
      z.object({
        // alphanumeric with underscores does not start with a number
        name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
          message: t('AddServerDialog.name.error'),
        }),
        serverUrl: z.string(),
      }),
    [t],
  );

  type AddSSEServerFormValues = z.infer<typeof AddSSEServerSchema>;

  const form = useForm<AddSSEServerFormValues>({
    resolver: zodResolver(AddSSEServerSchema),
    defaultValues: {
      name: '',
      serverUrl: '',
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
                labelVariant="simple"
                {...field}
                description={t('AddServerDialog.name.description')}
                placeholder={t('AddServerDialog.name.placeholder')}
                label={t('AddServerDialog.name.label')}
              />
            )}
          />
          <FormField
            name="serverUrl"
            render={({ field }) => (
              <Input
                fullWidth
                labelVariant="simple"
                {...field}
                label={t('AddServerDialog.serverUrl.label')}
                placeholder={t('AddServerDialog.serverUrl.placeholder')}
                description={t('AddServerDialog.serverUrl.description')}
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

function AddServerDialog(props: AddServerDialogProps) {
  const { trigger } = props;
  const [isOpen, setIsOpen] = useState(false);

  const { isLocal } = useCurrentAgentMetaData();
  const [serverType, setServerType] = useState<MCPServerType>('sse');

  const t = useTranslations('ToolsEditor/MCPServers');

  const options = useMemo(() => {
    return [
      { label: t('AddServerDialog.type.options.sse'), value: 'sse' },
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
            onCancel={() => {
              setIsOpen(false);
            }}
          />
        ) : (
          <AddSSEServerForm
            onCancel={() => {
              setIsOpen(false);
            }}
          />
        )}
      </VStack>
    </Dialog>
  );
}

interface MCPServerListProps {
  search: string;
  onSearchChange: (search: string) => void;
  setSelectedServerKey: (serverKey: string) => void;
  selectedServerKey?: string | null;
  servers: MCPServerItemType[];
  isMobile?: boolean;
}

function MCPServerList(props: MCPServerListProps) {
  const {
    search,
    onSearchChange,
    setSelectedServerKey,
    selectedServerKey,
    servers,
    isMobile,
  } = props;
  const t = useTranslations('ToolsEditor/MCPServers');

  return (
    <VStack
      gap={false}
      fullHeight
      borderRight
      fullWidth
      className={!isMobile ? 'max-w-[250px]' : 'w-full'}
    >
      <ToolSearchInput
        placeholder={t('search.placeholder')}
        isMobile={isMobile}
        search={search}
        onSearchChange={onSearchChange}
        action={
          <AddServerDialog
            trigger={
              <Button
                size="small"
                hideLabel
                preIcon={<PlusIcon />}
                label={t('AddServerDialog.addServer')}
                color="tertiary"
              />
            }
          />
        }
      />
      <VStack overflowY="auto" collapseHeight flex gap={false}>
        {servers.map((server) => (
          <HStack
            paddingY="xsmall"
            paddingX
            gap="small"
            justify="spaceBetween"
            align="center"
            fullWidth
            key={server.server_name}
            as="button"
            onClick={() => {
              if (server.server_name) {
                setSelectedServerKey(server.server_name);
              }
            }}
            className={cn(
              server.server_name === selectedServerKey
                ? 'bg-secondary-active'
                : '',
            )}
          >
            <HStack align="center" gap="small">
              <div className="min-w-[20px] h-[24px] items-center justify-center">
                <SpecificToolIcon toolType="external_mcp" />
              </div>
              <Typography
                fullWidth
                overflow="ellipsis"
                noWrap
                variant={isMobile ? 'body' : 'body2'}
              >
                {server.server_name || 'unnamed'}
              </Typography>
            </HStack>
            <Badge size="small" content={server.type} />
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

export function MCPServers() {
  const t = useTranslations('ToolsEditor/MCPServers');

  const { isLocal } = useCurrentAgentMetaData();

  const [search, setSearch] = React.useState('');

  const { data: servers, isLoading, isError } = useToolsServiceListMcpServers();
  const [selectedServerKey, setSelectedServerKey] = React.useState<
    string | null
  >(null);

  const serversAsArray = useMemo(() => {
    return Object.entries(servers || {}).map(([key, server]) => ({
      ...server,
      key,
    }));
  }, [servers]);

  useEffect(() => {
    if (servers && serversAsArray.length > 0) {
      setSelectedServerKey(serversAsArray[0].server_name);
    }
  }, [serversAsArray, servers]);

  const selectedServer = useMemo(() => {
    return Object.values(servers || {})?.find(
      ({ server_name: serverName }) => serverName === selectedServerKey,
    );
  }, [selectedServerKey, servers]);

  const filteredServers = useMemo(() => {
    return serversAsArray.filter(
      (server) => {
        return server.server_name?.toLowerCase().includes(search.toLowerCase());
      },
      [search],
    );
  }, [search, serversAsArray]);

  if (!isLocal) {
    return (
      <VStack fullWidth fullHeight align="center" justify="center">
        <LoadingEmptyStatusComponent emptyMessage={t('notLocal')} />
      </VStack>
    );
  }

  return (
    <ToolManagerPage border>
      {!servers || serversAsArray.length === 0 ? (
        <LoadingEmptyStatusComponent
          isLoading={isLoading}
          isError={isError}
          errorMessage={t('error')}
          loadingMessage={t('loading')}
          emptyMessage={t('empty')}
          emptyAction={
            <AddServerDialog
              trigger={
                <Button label={t('connect')} color="primary" fullWidth />
              }
            />
          }
        />
      ) : (
        <HStack gap={false} fullHeight fullWidth>
          <HiddenOnMobile>
            <MCPServerList
              search={search}
              onSearchChange={setSearch}
              selectedServerKey={selectedServerKey}
              setSelectedServerKey={setSelectedServerKey}
              servers={filteredServers}
            />
          </HiddenOnMobile>
          <VStack fullWidth fullHeight gap={false}>
            <VisibleOnMobile>
              <HStack color="background-grey" borderBottom fullWidth>
                <HStack paddingX="medium" height="header-sm" align="center">
                  <Popover
                    className="max-h-[300px] overflow-auto"
                    triggerAsChild
                    align="start"
                    trigger={
                      <Button
                        size="small"
                        fullWidth
                        color="tertiary"
                        preIcon={<SpecificToolIcon toolType="external_mcp" />}
                        postIcon={<ChevronDownIcon />}
                        label={selectedServer?.server_name || t('selectServer')}
                      />
                    }
                  >
                    <MCPServerList
                      search={search}
                      onSearchChange={setSearch}
                      selectedServerKey={selectedServerKey}
                      setSelectedServerKey={setSelectedServerKey}
                      servers={filteredServers}
                      isMobile
                    />
                  </Popover>
                </HStack>
              </HStack>
            </VisibleOnMobile>
            {!selectedServer ? (
              <LoadingEmptyStatusComponent emptyMessage={t('select')} />
            ) : (
              <SingleMCPServer server={selectedServer} />
            )}
          </VStack>
        </HStack>
      )}
    </ToolManagerPage>
  );
}
