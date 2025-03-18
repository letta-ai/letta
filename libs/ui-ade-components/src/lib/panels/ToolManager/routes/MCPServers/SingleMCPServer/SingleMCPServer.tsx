import {
  useToolsServiceDeleteMcpServer,
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
  TrashIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCallback, useState } from 'react';
import { AttachDetachButton } from '../../../components/AttachDetachButton/AttachDetachButton';
import { useCurrentAgent } from '../../../../../hooks';

interface RemoveMCPServerDialogProps {
  serverName: string;
  trigger: React.ReactNode;
}

function RemoveMCPServerDialog(props: RemoveMCPServerDialogProps) {
  const { serverName, trigger } = props;

  const [isOpen, setIsOpen] = useState(false);

  const { mutate, isError, isPending } = useToolsServiceDeleteMcpServer({
    onSuccess: () => {
      setIsOpen(false);
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

interface ServerToolsListProps {
  serverName: string;
}

function ServerToolsList(props: ServerToolsListProps) {
  const { serverName } = props;
  const t = useTranslations('ToolManager/SingleMCPServer');

  const { tools } = useCurrentAgent();

  const { data, isError, isLoading } = useToolsServiceListMcpToolsByServer({
    mcpServerName: serverName,
  });

  const getAttachedId = useCallback(
    (toolName: string) => {
      return (tools || []).find(
        (t) => t.name === toolName && t.tool_type === 'external_mcp',
      )?.id;
    },
    [tools],
  );

  if (!data || data?.length === 0) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={isLoading}
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

export function SingleMCPServer(props: SingleMCPServerProps) {
  const { server } = props;

  const t = useTranslations('ToolManager/SingleMCPServer');

  return (
    <VStack overflow="hidden" fullWidth fullHeight>
      <HStack borderBottom padding>
        <VStack fullWidth>
          <HStack fullWidth paddingBottom="large" justify="spaceBetween">
            <HStack align="center" gap="medium">
              <McpIcon />
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
            </DropdownMenu>
          </HStack>
          <VStack gap="large">
            {server.type === 'sse' ? (
              <VStack gap={false}>
                <Typography uppercase bold variant="body3">
                  {t('serverUrl')}
                </Typography>
                <Typography>
                  {(server as SSEServerConfig).server_url}
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
      <ServerToolsList serverName={server.server_name} />
    </VStack>
  );
}
