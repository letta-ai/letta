import {
  type ListMcpServersResponse,
  useToolsServiceDeleteMcpServer,
  UseToolsServiceListMcpServersKeyFn,
  useToolsServiceListMcpToolsByServer,
} from '@letta-cloud/sdk-core';
import type {
  MCPServerItemType,
  SSEServerConfig,
  StdioServerConfig,
} from '@letta-cloud/sdk-core';
import {
  Badge,
  Button,
  Dialog,
  DotsVerticalIcon,
  DropdownMenu,
  DropdownMenuItem,
  HStack,
  LoadingEmptyStatusComponent,
  McpIcon,
  RefreshIcon,
  TrashIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import React, {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { AttachDetachButton } from '../../../components/AttachDetachButton/AttachDetachButton';
import { useCurrentAgent } from '../../../../../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { getObfuscatedMCPServerUrl } from '@letta-cloud/utils-shared';
import { MCPServerLogo } from '../../MCPServerExplorer/MCPServerLogo/MCPServerLogo';

interface RemoveMCPServerDialogProps {
  serverName: string;
  trigger: React.ReactNode;
}

function RemoveMCPServerDialog(props: RemoveMCPServerDialogProps) {
  const { serverName, trigger } = props;

  const [isOpen, setIsOpen] = useState(false);

  const queryClient = useQueryClient();

  const { mutate, isError, isPending } = useToolsServiceDeleteMcpServer({
    onSuccess: () => {
      setIsOpen(false);
      queryClient.setQueriesData<ListMcpServersResponse | undefined>(
        {
          queryKey: UseToolsServiceListMcpServersKeyFn(),
        },
        (data) => {
          if (!data) {
            return undefined;
          }

          return Object.values(data).reduce((acc, item) => {
            if (item.server_name !== serverName) {
              acc[item.server_name] = item;
            }

            return acc;
          }, {} as ListMcpServersResponse);
        },
      );
    },
  });

  const t = useTranslations('ToolManager/SingleMCPServer');
  const handleRemove = useCallback(() => {
    mutate({
      mcpServerName: serverName,
    });
  }, [mutate, serverName]);

  return (
    <Dialog
      errorMessage={isError ? t('RemoveMCPServerDialog.error') : undefined}
      isConfirmBusy={isPending}
      isOpen={isOpen}
      trigger={trigger}
      onOpenChange={setIsOpen}
      title={t('RemoveMCPServerDialog.title')}
      onConfirm={handleRemove}
      confirmText={t('RemoveMCPServerDialog.confirm')}
    >
      <Typography>{t('RemoveMCPServerDialog.description')}</Typography>
    </Dialog>
  );
}

interface ServerToolsRef {
  reload: () => void;
}

interface ServerToolsListProps {
  serverName: string;
  ref?: React.RefObject<ServerToolsRef>;
}

function ServerToolsList(props: ServerToolsListProps) {
  const { serverName, ref } = props;
  const t = useTranslations('ToolManager/SingleMCPServer');

  const { tools } = useCurrentAgent();

  const { data, isError, isFetching, refetch } =
    useToolsServiceListMcpToolsByServer({
      mcpServerName: serverName,
    });

  useImperativeHandle(ref, () => ({
    reload: () => {
      void refetch();
    },
  }));

  const getAttachedId = useCallback(
    (toolName: string) => {
      return (tools || []).find(
        (t) => t.name === toolName && t.tool_type === 'external_mcp',
      )?.id;
    },
    [tools],
  );

  if (!data || data?.length === 0 || isFetching) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={isFetching}
        loadingMessage={t('ServerToolsList.loading')}
        emptyMessage={t('ServerToolsList.empty')}
        isError={isError}
        errorMessage={t('ServerToolsList.error')}
      />
    );
  }

  return (
    <VStack overflowY="auto" collapseHeight padding="small" flex>
      {data.map((tool) => (
        <VStack
          padding="small"
          gap="small"
          color="background-grey"
          key={tool.name}
          fullWidth
        >
          <HStack justify="spaceBetween">
            <Typography fullWidth overflow="ellipsis" bold variant="body2">
              {tool.name}
            </Typography>
            <AttachDetachButton
              attachedId={getAttachedId(tool.name) || undefined}
              toolType="external_mcp"
              idToAttach={`${serverName}:${tool.name}`}
            />
          </HStack>
          <Typography variant="body2">{tool.description}</Typography>
        </VStack>
      ))}
    </VStack>
  );
}

interface SingleMCPServerProps {
  server: MCPServerItemType;
}

function serverHasServerUrl(
  server: MCPServerItemType,
): server is SSEServerConfig {
  return (server as SSEServerConfig).server_url !== undefined;
}

export function SingleMCPServer(props: SingleMCPServerProps) {
  const { server } = props;

  const t = useTranslations('ToolManager/SingleMCPServer');

  const ref = useRef<ServerToolsRef>({
    reload: () => {
      return;
    },
  });

  return (
    <VStack fullWidth flex fullHeight>
      <HStack borderBottom padding>
        <VStack fullWidth>
          <HStack fullWidth paddingBottom="large" justify="spaceBetween">
            <HStack align="center" gap="medium">
              {serverHasServerUrl(server) ? (
                <MCPServerLogo serverUrl={server.server_url} />
              ) : (
                <McpIcon />
              )}
              <VStack gap={false}>
                <Typography>{server.server_name}</Typography>
              </VStack>
            </HStack>
            <DropdownMenu
              align="end"
              triggerAsChild
              trigger={
                <Button
                  label={t('actions')}
                  color="tertiary"
                  hideLabel
                  size="small"
                  postIcon={<DotsVerticalIcon />}
                />
              }
            >
              <RemoveMCPServerDialog
                serverName={server.server_name}
                trigger={
                  <DropdownMenuItem
                    preIcon={<TrashIcon />}
                    doNotCloseOnSelect
                    label={t('remove')}
                  />
                }
              />
              <DropdownMenuItem
                preIcon={<RefreshIcon />}
                onClick={() => {
                  ref.current?.reload();
                }}
                label={t('refetch')}
              />
            </DropdownMenu>
          </HStack>
          <VStack gap="large">
            {server.type === 'sse' ? (
              <VStack gap={false}>
                <Typography uppercase bold variant="body3">
                  {t('serverUrl')}
                </Typography>
                <Typography>
                  {getObfuscatedMCPServerUrl(
                    (server as SSEServerConfig).server_url,
                  )}
                </Typography>
              </VStack>
            ) : (
              <VStack gap={false}>
                <Typography uppercase bold variant="body3">
                  {t('command')}
                </Typography>
                <Typography>{(server as StdioServerConfig).command}</Typography>
              </VStack>
            )}
            <VStack gap={false}>
              <Typography uppercase bold variant="body3">
                {t('serverType')}
              </Typography>
              <div>
                <Badge content={server.type} size="small" />
              </div>
            </VStack>
          </VStack>
        </VStack>
      </HStack>
      <ServerToolsList ref={ref} serverName={server.server_name} />
    </VStack>
  );
}
