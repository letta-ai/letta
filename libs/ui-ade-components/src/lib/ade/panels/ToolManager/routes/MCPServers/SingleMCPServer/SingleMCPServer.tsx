import {
  type ListMcpServersResponse,
  useToolsServiceDeleteMcpServer,
  UseToolsServiceListMcpServersKeyFn,
  useToolsServiceListMcpToolsByServer,
  UseToolsServiceListToolsKeyFn,
  useToolsServiceResyncMcpServerTools,
  useToolsServiceListTools,
  type MCPTool,
} from '@letta-cloud/sdk-core';
import { toast } from '@letta-cloud/ui-component-library';
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
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@letta-cloud/ui-styles';
import { AttachDetachButton } from '../../../components/AttachDetachButton/AttachDetachButton';
import { useCurrentAgent } from '../../../../../../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { getObfuscatedMCPServerUrl } from '@letta-cloud/utils-shared';
import { MCPServerLogo } from '../../MCPServerExplorer/MCPServerLogo/MCPServerLogo';
import { toMCPServerTypeLabel } from '../types';
import { UpdateMCPServerDialog } from '../UpdateMCPServerDialog/UpdateMCPServerDialog';
import { getAuthModeAndValuesFromServer } from '../utils';
import { AuthModes } from '../AuthenticationSection';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { MCPToolSimulator } from '../MCPToolSimulator/MCPToolSimulator';
import { UseToolsServiceListMcpToolsByServerKeyFn } from '@letta-cloud/sdk-core';

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
        mcp_server_name: serverName,
        mcp_server_type: serverType,
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
  onResync: () => void;
  isResyncing: boolean;
}

function ServerToolsList(props: ServerToolsListProps) {
  const { serverName, ref, selectedTool, onToolSelect, onResync, isResyncing } = props;
  const t = useTranslations('ToolManager/SingleMCPServer');
  const { tools } = useCurrentAgent();

  const queryClient = useQueryClient();
  const queryKey = UseToolsServiceListMcpToolsByServerKeyFn({
    mcpServerName: serverName,
  });
  const cachedState = queryClient.getQueryState(queryKey);
  const hasError = cachedState?.error != null;

  const { data, isError, isFetching, refetch } =
    useToolsServiceListMcpToolsByServer(
      {
        mcpServerName: serverName,
      },
      undefined,
      {
        retry: 0,
        enabled: !hasError,
        staleTime: 60 * 1000,
        gcTime: 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      }
    );

  // Fetch all persisted tools to check for desync
  const { data: allPersistedTools } = useToolsServiceListTools({
    limit: 1000, // High limit to get all tools
  });

  // Check if tools are out of sync
  const isOutOfSync = useMemo(() => {
    if (!data || !allPersistedTools) return false;
    // Filter persisted tools for this MCP server
    const persistedMcpTools = allPersistedTools.filter(
      (tool) =>
        tool.tool_type === 'external_mcp' &&
        (tool.metadata_ as any)?.mcp?.server_name === serverName
    );

    // If no persisted tools yet, that's fine - not out of sync
    if (persistedMcpTools.length === 0) return false;

    // Create map of live tools for quick lookup
    const liveToolsMap = new Map(data.map(tool => [tool.name, tool]));

    // Check each persisted tool to see if it's stale or deleted
    for (const persistedTool of persistedMcpTools) {
      const liveTool = persistedTool.name ? liveToolsMap.get(persistedTool.name) : null;

      // Tool no longer exists in live tools - it was deleted
      if (!liveTool) return true;

      // Compare argument schemas to check if schema is stale
      const liveParams = (liveTool.inputSchema?.properties || {}) as Record<string, any>;
      const persistedParams = ((persistedTool as any).json_schema?.parameters?.properties || {}) as Record<string, any>;

      // Check if same number of parameters
      const liveParamKeys = Object.keys(liveParams);
      const persistedParamKeys = Object.keys(persistedParams).filter(key => key !== 'request_heartbeat');

      if (liveParamKeys.length !== persistedParamKeys.length) return true;


      // Check if parameter names and types match
      for (const paramName of persistedParamKeys) {
        if (!liveParams[paramName]) return true;

        // Simple type comparison
        // Extract all possible types from live parameter
        const getTypes = (param: any): string[] => {
          if (param?.type) {
            return [param.type];
          }
          const params: any= [];
          if (param?.anyOf) {
            for (const option of param.anyOf) {
              params.push(option.type);
            }
            return [params];
          }
          return [];
        };

        const liveTypes = getTypes(liveParams[paramName]).flat();
        const persistedTypes = getTypes(persistedParams[paramName]).flat();
        // Compare type arrays - they should have the same types
        const typesMatch = liveTypes.length === persistedTypes.length &&
                          liveTypes.every(type => persistedTypes.includes(type));

        if (!typesMatch) return true;
      }
    }

    return false;
  }, [data, allPersistedTools, serverName]);

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

  // Auto-select first tool when data loads or server changes
  useEffect(() => {
    if (data && data.length > 0) {
      onToolSelect(data[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, serverName]); // Intentionally omitting onToolSelect to prevent loops

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
            padding="small"
            fullHeight
            color="background"
            overflowY="auto"
            gap={false}
          >
            {isOutOfSync && (
              <HStack paddingBottom="small" justify="center" fullWidth>
                <Button
                  color="brand"
                  size="small"
                  onClick={onResync}
                  busy={isResyncing}
                  preIcon={<RefreshIcon />}
                  label={t('ServerToolsList.schemaHealth.desyncWarning')}
                  fullWidth
                />
              </HStack>
            )}
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
                      tooltip: t(
                        'ServerToolsList.schemaHealth.notStrict.tooltip',
                      ),
                    };
                    break;
                  case 'INVALID':
                    healthBadge = {
                      variant: 'destructive',
                      label: t(
                        'ServerToolsList.schemaHealth.invalidSchema.label',
                      ),
                      tooltip: t(
                        'ServerToolsList.schemaHealth.invalidSchema.tooltip',
                      ),
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
                  key={tool.name}
                  gap="small"
                  align="center"
                  justify="spaceBetween"
                  className={cn(
                    'w-full',
                    selectedTool?.name === tool.name
                      ? 'bg-secondary-active'
                      : '',
                  )}
                >
                  <button
                    onClick={() => {
                      onToolSelect(tool);
                    }}
                    className="flex-1 px-2 py-2 flex items-center gap-2 text-left cursor-pointer overflow-hidden min-w-0"
                  >
                    <ToolsIcon className="flex-shrink-0" />
                    <HStack
                      gap="medium"
                      align="end"
                      flex
                      collapseWidth
                      overflow="hidden"
                      paddingRight="xsmall"
                    >
                      <Typography
                        overflow="ellipsis"
                        bold
                        variant="body2"
                        noWrap
                        fullWidth
                      >
                        {tool.name}
                      </Typography>
                      <VStack>
                        {healthBadge && (
                          <Tooltip content={healthBadge.tooltip} asChild>
                            <Badge
                              content={healthBadge.label}
                              variant={healthBadge.variant}
                              size="small"
                              className="flex-shrink-0"
                            />
                          </Tooltip>
                        )}
                      </VStack>
                    </HStack>
                  </button>
                  <div className="flex-shrink-0 p-2">
                    <AttachDetachButton
                      attachedId={getAttachedId(tool.name) || undefined}
                      toolType="external_mcp"
                      idToAttach={`${serverName}:${tool.name}`}
                      toolName={tool.name}
                      size="xsmall"
                      hideLabel
                      disabled={tool.health?.status === 'INVALID'}
                    />
                  </div>
                </HStack>
              );
            })}
          </VStack>
        </Panel>
        <PanelResizeHandle
          className="w-[1px] h-full bg-border"
          /* eslint-disable-next-line react/forbid-component-props */
          style={{ cursor: 'col-resize' }}
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
  const tAuth = useTranslations('ToolsEditor/MCPServers');
  const queryClient = useQueryClient();

  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);

  // Resync tools mutation
  const { mutate: resyncTools, isPending: isResyncing } = useToolsServiceResyncMcpServerTools({
    onSuccess: (response) => {
      // Invalidate the tools list queries to refetch the updated tools
      queryClient.invalidateQueries({
        queryKey: UseToolsServiceListMcpToolsByServerKeyFn({
          mcpServerName: server.server_name,
        }),
      });

      // Also invalidate the general tools list to update isOutOfSync state
      queryClient.invalidateQueries({
        queryKey: UseToolsServiceListToolsKeyFn({
          limit: 1000,
        }),
      });

      // Display resync results
      // TODO: Surface response type from the API
      const data = response as {
        deleted: string[];
        updated: string[];
        added: string[];
      } | null;

      if (data) {
        const hasChanges = data.added.length > 0 || data.updated.length > 0 || data.deleted.length > 0;

        if (hasChanges) {
          let message = t('resyncSuccess');
          const parts: string[] = [];

          if (data.added.length > 0) {
            parts.push(`${data.added.length} ${data.added.length > 1 ? 'tools' : 'tool'} ${t('resyncAdded')}`);
          }
          if (data.updated.length > 0) {
            parts.push(`${data.updated.length} ${data.updated.length > 1 ? 'tools' : 'tool'} ${t('resyncUpdated')}`);
          }
          if (data.deleted.length > 0) {
            parts.push(`${data.deleted.length} ${data.deleted.length > 1 ? 'tools' : 'tool'} ${t('resyncDeleted')}`);
          }

          if (parts.length > 0) {
            message += ': ' + parts.join(', ');
          }

          toast.success(message, {duration: 5000});
        } else {
          toast.success(t('resyncNoChanges'), {duration: 5000});
        }
      }
    },
    onError: () => {
      toast.error(t('resyncError'), {duration: 10000});
    },
  });

  // Determine auth type for display
  const authType = useMemo(() => {
    // StdioServerConfig doesn't have auth properties
    if (!getIsStreamableOrHttpServer(server)) {
      return tAuth('AddServerDialog.authMode.none');
    }

    const { authMode } = getAuthModeAndValuesFromServer(server);
    switch (authMode) {
      case AuthModes.NONE:
        return tAuth('AddServerDialog.authMode.none');
      case AuthModes.API_KEY:
        return tAuth('AddServerDialog.authMode.apiKey');
      case AuthModes.CUSTOM_HEADERS:
        return tAuth('AddServerDialog.authMode.customHeaders');
      default:
        return tAuth('AddServerDialog.authMode.none');
    }
  }, [server, tAuth]);

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
                  resyncTools({ mcpServerName: server.server_name });
                }}
                disabled={isResyncing}
                label={t('resyncTools')}
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
          <HStack gap="xlarge" align="start">
            {getIsStreamableOrHttpServer(server) ? (
              <VStack gap={false}>
                <Typography uppercase bold variant="body3">
                  {t('serverUrl')}
                </Typography>
                <div>
                  <Badge
                    content={getObfuscatedMCPServerUrl(server.server_url)}
                    size="small"
                  />
                </div>
              </VStack>
            ) : (
              <VStack gap={false}>
                <Typography uppercase bold variant="body3">
                  {t('command')}
                </Typography>
                <div>
                  <Badge content={server.command} size="small" />
                </div>
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
            <VStack gap={false}>
              <Typography uppercase bold variant="body3">
                {t('authentication')}
              </Typography>
              <div>
                <Badge content={authType} size="small" />
              </div>
            </VStack>
          </HStack>
        </VStack>
      </HStack>
      <VStack fullWidth flex collapseHeight borderTop>
        <ServerToolsList
          ref={ref}
          serverName={server.server_name}
          selectedTool={selectedTool}
          onToolSelect={setSelectedTool}
          onResync={() => resyncTools({ mcpServerName: server.server_name })}
          isResyncing={isResyncing}
        />
      </VStack>
    </VStack>
  );
}
