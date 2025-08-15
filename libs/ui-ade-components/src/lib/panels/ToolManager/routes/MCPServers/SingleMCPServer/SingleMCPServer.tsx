import {
  type ListMcpServersResponse,
  useToolsServiceDeleteMcpServer,
  UseToolsServiceListMcpServersKeyFn,
  useToolsServiceListMcpToolsByServer,
  type MCPTool,
} from '@letta-cloud/sdk-core';
import type { MCPServerItemType } from '@letta-cloud/sdk-core';
import { getIsStreamableOrHttpServer } from '../types';
import {
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
  Tooltip,
  TrashIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { cn } from '@letta-cloud/ui-styles';
import { AttachDetachButton } from '../../../components/AttachDetachButton/AttachDetachButton';
import { useCurrentAgent } from '../../../../../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { getObfuscatedMCPServerUrl } from '@letta-cloud/utils-shared';
import { MCPServerLogo } from '../../MCPServerExplorer/MCPServerLogo/MCPServerLogo';
import { toMCPServerTypeLabel } from '../types';
import { UpdateMCPServerDialog } from '../UpdateMCPServerDialog/UpdateMCPServerDialog';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { MCPToolSimulator } from '../MCPToolSimulator/MCPToolSimulator';


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
  selectedTool: MCPTool | null;
  onToolSelect: (tool: MCPTool) => void;
}

function ServerToolsList(props: ServerToolsListProps) {
  const { serverName, ref, selectedTool, onToolSelect } = props;
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

  useEffect(() => {
    if (data && data.length > 0 && !selectedTool) {
      onToolSelect(data[0]);
    }
  }, [data, selectedTool, onToolSelect]);

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
    <VStack
      collapseWidth
      flex
      fullHeight
      className="h-full w-full overflow-hidden"
    >
      <PanelGroup
        className="h-full w-full"
        direction="horizontal"
        autoSaveId="mcp-tool-playground"
      >
        <Panel
          defaultSize={30}
          defaultValue={30}
          className="h-full overflow-y-auto"
          minSize={20}
        >
          <VStack
            gap={false}
            fullHeight
            color="background"
            overflowY="auto"
          >
            {data.map((tool) => {
              let healthBadge: {
                variant: 'destructive' | 'success' | 'warning';
                label: string;
                tooltip?: string;
              } | null = null;

              if (tool.health) {
                switch (tool.health.status) {
                  case 'NON_STRICT_ONLY':
                    healthBadge = {
                      variant: 'warning',
                      label: t('ServerToolsList.schemaHealth.notStrict.label'),
                      tooltip: t('ServerToolsList.schemaHealth.notStrict.tooltip')
                    };
                    break;
                  case 'INVALID':
                    healthBadge = {
                      variant: 'destructive',
                      label: t('ServerToolsList.schemaHealth.invalidSchema.label'),
                      tooltip: t('ServerToolsList.schemaHealth.invalidSchema.tooltip')
                    };
                    break;
                  case 'STRICT_COMPLIANT':
                  default:
                    healthBadge = null;
                    break;
                }
              }

              return (
                <HStack
                  padding="small"
                  gap={false}
                  key={tool.name}
                  justify="spaceBetween"
                  align="center"
                  className={cn(
                    "w-full",
                    selectedTool?.name === tool.name
                      ? "bg-secondary-active"
                      : ""
                  )}
                >
                  <button
                    onClick={() => {
                      onToolSelect(tool);
                    }}
                    className="flex-1 flex items-center gap-2 text-left cursor-pointer p-1"
                  >
                    <ToolsIcon />
                    <HStack gap="medium" align="end">
                      <Typography
                        overflow="ellipsis"
                        bold
                        variant="body2"
                      >
                        {tool.name}
                      </Typography>
                      {healthBadge && (
                        <Tooltip content={healthBadge.tooltip} asChild>
                          <Badge
                            content={healthBadge.label}
                            variant={healthBadge.variant}
                            size="small"
                          />
                        </Tooltip>
                      )}
                    </HStack>
                  </button>
                  <HStack gap="small">
                    <AttachDetachButton
                      attachedId={getAttachedId(tool.name) || undefined}
                      toolType="external_mcp"
                      idToAttach={`${serverName}:${tool.name}`}
                      toolName={tool.name}
                      size="xsmall"
                      disabled={tool.health?.status === 'INVALID'}
                    />
                  </HStack>
                </HStack>
              );
            })}
          </VStack>
        </Panel>
        <PanelResizeHandle
          className="w-[1px] h-full bg-border"
          /* eslint-disable-next-line react/forbid-component-props */
          style={{ cursor: "col-resize" }}
        />
        <Panel
          defaultSize={70}
          defaultValue={70}
          className="h-full"
          minSize={20}
        >
          <MCPToolSimulator tool={selectedTool} serverName={serverName} />
        </Panel>
      </PanelGroup>
    </VStack>
  );
}

interface SingleMCPServerProps {
  server: MCPServerItemType;
}

export function SingleMCPServer(props: SingleMCPServerProps) {
  const { server } = props;

  const t = useTranslations('ToolManager/SingleMCPServer');

  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);

  const ref = useRef<ServerToolsRef>({
    reload: () => {
      return;
    },
  });

  return (
    <VStack fullWidth flex fullHeight>
      <HStack padding>
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
      <VStack fullWidth flex fullHeight borderTop>
        <ServerToolsList
          ref={ref}
          serverName={server.server_name}
          selectedTool={selectedTool}
          onToolSelect={setSelectedTool}
        />
      </VStack>
    </VStack>
  );
}
