import {
  type ListMcpServersResponse,
  useToolsServiceDeleteMcpServer,
  UseToolsServiceListMcpServersKeyFn,
  useToolsServiceListMcpToolsByServer,
} from '@letta-cloud/sdk-core';
import type { MCPServerItemType } from '@letta-cloud/sdk-core';
import { getIsStreamableOrHttpServer } from '../types';
import {
  Accordion,
  Badge,
  Button,
  Dialog,
  DotsVerticalIcon,
  DropdownMenu,
  DropdownMenuItem,
  EditIcon,
  HStack,
  LoadingEmptyStatusComponent,
  McpIcon,
  RefreshIcon,
  ToolsIcon,
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
import { toMCPServerTypeLabel } from '../types';
import { UpdateMCPServerDialog } from '../UpdateMCPServerDialog/UpdateMCPServerDialog';
import { MCPToolParameters } from '../MCPToolParameters';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

interface RemoveMCPServerDialogProps {
  serverName: string;
  serverType?: string;
  trigger: React.ReactNode;
}

function RemoveMCPServerDialog(props: RemoveMCPServerDialogProps) {
  const { serverName, trigger, serverType } = props;

  const [isOpen, setIsOpen] = useState(false);

  const queryClient = useQueryClient();

  const { mutate, isError, isPending } = useToolsServiceDeleteMcpServer({
    onSuccess: () => {
      trackClientSideEvent(AnalyticsEvent.DELETE_MCP_SERVER, {
        mcpServerName: serverName,
        mcpServerType: serverType,
      });

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

  if (isError || !data || data?.length === 0 || isFetching) {
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
          gap={false}
          color="background-grey"
          key={tool.name}
          fullWidth
        >
          <HStack padding="xxsmall" justify="spaceBetween" align="center">
            <ToolsIcon />
            <Typography fullWidth overflow="ellipsis" bold variant="body2">
              {tool.name}
            </Typography>
            <AttachDetachButton
              attachedId={getAttachedId(tool.name) || undefined}
              toolType="external_mcp"
              idToAttach={`${serverName}:${tool.name}`}
              toolName={tool.name}
            />
          </HStack>
          {tool.description && (
            <Accordion
              id={tool.name}
              trigger={
                <VStack paddingX="small">
                  <Typography variant="body2">{tool.description}</Typography>
                </VStack>
              }
            >
              {tool.inputSchema && (
                <VStack gap="text" paddingX="large" paddingY="small">
                  <MCPToolParameters inputSchema={tool.inputSchema} />
                </VStack>
              )}
            </Accordion>
          )}
        </VStack>
      ))}
    </VStack>
  );
}

interface SingleMCPServerProps {
  server: MCPServerItemType;
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
              {getIsStreamableOrHttpServer(server) ? (
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
              <DropdownMenuItem
                preIcon={<RefreshIcon />}
                onClick={() => {
                  ref.current?.reload();
                }}
                label={t('refetch')}
              />
              <UpdateMCPServerDialog
                server={server}
                trigger={
                  <DropdownMenuItem
                    preIcon={<EditIcon />}
                    doNotCloseOnSelect
                    label={t('edit')}
                  />
                }
              />
              <RemoveMCPServerDialog
                serverName={server.server_name}
                serverType={server.type}
                trigger={
                  <DropdownMenuItem
                    preIcon={<TrashIcon />}
                    doNotCloseOnSelect
                    label={t('remove')}
                  />
                }
              />
            </DropdownMenu>
          </HStack>
          <VStack gap="large">
            {getIsStreamableOrHttpServer(server) ? (
              <VStack gap={false}>
                <Typography uppercase bold variant="body3">
                  {t('serverUrl')}
                </Typography>
                <Typography>
                  {getObfuscatedMCPServerUrl(server.server_url)}
                </Typography>
              </VStack>
            ) : (
              <VStack gap={false}>
                <Typography uppercase bold variant="body3">
                  {t('command')}
                </Typography>
                <Typography>{server.command}</Typography>
              </VStack>
            )}
            <VStack gap={false}>
              <Typography uppercase bold variant="body3">
                {t('serverType')}
              </Typography>
              <div>
                <Badge
                  content={toMCPServerTypeLabel(server.type)}
                  size="small"
                />
              </div>
            </VStack>
          </VStack>
        </VStack>
      </HStack>
      <ServerToolsList ref={ref} serverName={server.server_name} />
    </VStack>
  );
}
