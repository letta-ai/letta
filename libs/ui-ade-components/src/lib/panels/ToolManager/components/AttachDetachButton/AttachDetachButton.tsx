'use client';
import { useTranslations } from '@letta-cloud/translations';
import { useIsComposioConnected } from '../../hooks/useIsComposioConnected/useIsComposioConnected';
import type { Tool } from '@letta-cloud/sdk-core';
import {
  type ToolType,
  type AgentState,
  useAgentsServiceAttachTool,
  useAgentsServiceDetachTool,
  useToolsServiceAddComposioTool,
  useToolsServiceAddMcpTool,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';

interface ToolWithMCPMetadata extends Tool {
  metadata_?: {
    mcp?: {
      server_name?: string;
    };
    [key: string]: unknown;
  } | null;
}
import {
  AddLinkIcon,
  Button,
  Dialog,
  HStack,
  LinkOffIcon,
  toast,
  Typography,
} from '@letta-cloud/ui-component-library';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../../../hooks';
import { useCallback, useState } from 'react';
import { get } from 'lodash-es';
import { useOptimisticAgentTools } from '../../hooks/useOptimisticAgentTools/useOptimisticAgentTools';
import { useQueryClient } from '@tanstack/react-query';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

interface AttachComposioToolProps {
  idToAttach: string;
}

// TODO: DEPRECATING...
function AttachComposioTool(props: AttachComposioToolProps) {
  const { idToAttach } = props;
  const t = useTranslations('ToolActionsHeader');
  const { isConnected: isComposioConnected } = useIsComposioConnected();
  const { mutateAsync: addComposioTool } = useToolsServiceAddComposioTool();
  const { id: agentId } = useCurrentAgent();
  const { addOptimisticTool, updateAgentTools, removeOptimisticTool } =
    useOptimisticAgentTools(agentId);
  const { mutateAsync: attachToolToAgent } = useAgentsServiceAttachTool();

  const [isPending, setIsPending] = useState(false);

  const handleAddTool = useCallback(async () => {
    let toolToRollback: {
      id: string;
      name: string;
      tool_type: ToolType;
    } | null = null;

    try {
      setIsPending(true);

      const composioTool = await addComposioTool({
        composioActionName: idToAttach,
      });

      const toolIdToAdd = composioTool.id || '';

      if (toolIdToAdd && composioTool.name && composioTool.tool_type) {
        toolToRollback = {
          id: toolIdToAdd,
          name: composioTool.name,
          tool_type: composioTool.tool_type,
        };
        addOptimisticTool(toolToRollback);
      }

      const response = await attachToolToAgent({
        agentId,
        toolId: toolIdToAdd,
      });
      updateAgentTools(response);
    } catch (e) {
      if (toolToRollback) {
        removeOptimisticTool(toolToRollback.id);
      }

      let errorMessage = t('AttachComposioTool.GenericSDKError');
      const errorCode = get(e, 'body.detail.code') || '';

      if (errorCode) {
        switch (errorCode) {
          case 'ComposioSDKError': {
            errorMessage = t('AttachComposioTool.ComposioSDKError');
            break;
          }

          case 'ApiKeyNotProvidedError': {
            errorMessage = t('AttachComposioTool.ApiKeyNotProvidedError');
            break;
          }

          default: {
            errorMessage = t('AttachComposioTool.GenericSDKError');
            break;
          }
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsPending(false);
    }
  }, [
    addComposioTool,
    agentId,
    attachToolToAgent,
    updateAgentTools,
    addOptimisticTool,
    removeOptimisticTool,
    t,
    idToAttach,
  ]);

  return (
    <Button
      color="secondary"
      preIcon={<AddLinkIcon />}
      label={t('AttachComposioTool.label')}
      busy={isPending}
      onClick={handleAddTool}
      disabled={!isComposioConnected}
    />
  );
}

interface AttachMCPToolProps {
  idToAttach: string;
  size?: 'default' | 'large' | 'small' | 'xsmall';
}

function AttachMCPTool(props: AttachMCPToolProps) {
  const { idToAttach, size } = props;
  const [mcpServerName, mcpToolName] = idToAttach.split(':');
  const t = useTranslations('ToolActionsHeader');
  const { mutateAsync: addMCPTool, isPending } = useToolsServiceAddMcpTool();
  const { id: agentId } = useCurrentAgent();
  const { addOptimisticTool, updateAgentTools, removeOptimisticTool } =
    useOptimisticAgentTools(agentId);
  const { mutateAsync: attachToolToAgent } = useAgentsServiceAttachTool();

  const handleAttach = useCallback(async () => {
    let toolToRollback: {
      id: string;
      name: string;
      tool_type: ToolType;
    } | null = null;

    trackClientSideEvent(AnalyticsEvent.ATTACH_MCP_SERVER_TOOL, {
      agentId,
      mcpServerName,
      mcpToolName,
    });

    try {
      const mcpTool = await addMCPTool({
        mcpServerName,
        mcpToolName,
      });

      const toolIdToAdd = mcpTool.id || '';

      if (toolIdToAdd && mcpTool.name && mcpTool.tool_type) {
        toolToRollback = {
          id: toolIdToAdd,
          name: mcpTool.name,
          tool_type: mcpTool.tool_type,
        };
        addOptimisticTool(toolToRollback);
      }

      const response = await attachToolToAgent({
        agentId,
        toolId: toolIdToAdd,
      });

      updateAgentTools(response);
    } catch (_e) {
      if (toolToRollback) {
        removeOptimisticTool(toolToRollback.id);
      }

      toast.error(t('AttachMCPTool.error'));
    }
  }, [
    addMCPTool,
    agentId,
    attachToolToAgent,
    updateAgentTools,
    addOptimisticTool,
    removeOptimisticTool,
    mcpServerName,
    mcpToolName,
    t,
  ]);

  return (
    <Button
      color="secondary"
      size={size}
      preIcon={<AddLinkIcon />}
      busy={isPending}
      label={t('AttachMCPTool.label')}
      onClick={handleAttach}
    />
  );
}

interface AttachLocalToolProps {
  idToAttach: string;
  toolType: ToolType;
  toolName?: string;
}

function AttachLocalTool(props: AttachLocalToolProps) {
  const { idToAttach, toolName, toolType } = props;
  const t = useTranslations('ToolActionsHeader');
  const { id: agentId } = useCurrentAgent();
  const { addOptimisticTool, updateAgentTools, removeOptimisticTool } =
    useOptimisticAgentTools(agentId);

  const { mutate } = useAgentsServiceAttachTool({
    onMutate: () => {
      addOptimisticTool({
        id: idToAttach,
        name: toolName || idToAttach,
        tool_type: 'custom',
      });

      return {
        toolToRestore: {
          id: idToAttach,
          name: toolName || idToAttach,
          tool_type: 'custom' as ToolType,
        },
      };
    },
    onError: (_error, _variables, context) => {
      if (context?.toolToRestore) {
        removeOptimisticTool(context.toolToRestore.id);
      }
      toast.error(t('AttachLocalTool.error'));
    },
    onSuccess: (payload) => {
      updateAgentTools(payload);
    },
  });

  const handleAttach = useCallback(async () => {
    trackClientSideEvent(AnalyticsEvent.ATTACH_TOOL, {
      toolType: toolType,
      agentId,
      toolId: idToAttach,
    });

    mutate({
      agentId,
      toolId: idToAttach,
    });
  }, [toolType, agentId, idToAttach, mutate]);

  return (
    <Button
      data-testid="attach-tool-to-agent"
      color="secondary"
      preIcon={<AddLinkIcon />}
      label={t('AttachLocalTool.label')}
      onClick={handleAttach}
    />
  );
}

interface AttachToolToAgentButtonProps {
  idToAttach: string;
  toolType: ToolType;
  toolName?: string;
  size?: 'default' | 'large' | 'small' | 'xsmall';
}

function AttachToolToAgentButton(props: AttachToolToAgentButtonProps) {
  const { idToAttach, toolType, toolName, size } = props;

  switch (toolType) {
    case 'external_composio':
      return <AttachComposioTool idToAttach={idToAttach} />;
    case 'custom':
    case 'letta_multi_agent_core':
    case 'letta_core':
    case 'letta_memory_core':
    case 'letta_builtin':
    case 'letta_sleeptime_core':
      return (
        <AttachLocalTool
          toolType={toolType}
          idToAttach={idToAttach}
          toolName={toolName}
        />
      );

    case 'external_mcp':
      return <AttachMCPTool idToAttach={idToAttach} size={size} />;

    default:
      return null;
  }
}

interface DetachToolDialogProps {
  toolType: ToolType;
  idToDetach: string;
  size?: 'default' | 'large' | 'small' | 'xsmall';
}

function DetachToolDialog(props: DetachToolDialogProps) {
  const { idToDetach, toolType, size} = props;
  const { id: agentId } = useCurrentAgent();
  const { removeOptimisticTool, updateAgentTools, addOptimisticTool } =
    useOptimisticAgentTools(agentId);
  const queryClient = useQueryClient();

  const t = useTranslations('ToolActionsHeader');

  const [open, setOpen] = useState(false);

  const getToolToRestore = useCallback(
    (idToDetach: string): ToolWithMCPMetadata | undefined => {
      const currentAgentState = queryClient.getQueryData<AgentState>(
        UseAgentsServiceRetrieveAgentKeyFn({
          agentId,
        }),
      );

      const toolToRestore = currentAgentState?.tools?.find(
        (tool) => tool.id === idToDetach,
      );

      return toolToRestore;
    },
    [queryClient, agentId],
  );

  const { mutate, isPending } = useAgentsServiceDetachTool({
    onError: (_error, _variables, context) => {
      if (context?.toolToRestore) {
        addOptimisticTool(context.toolToRestore);
      }
      toast.error(t('DetachToolDialog.error'));
    },
    onMutate: () => {
      const toolToRestore = getToolToRestore(idToDetach);

      removeOptimisticTool(idToDetach);

      if (toolToRestore?.id && toolToRestore.name && toolToRestore.tool_type) {
        return {
          toolToRestore: {
            id: toolToRestore.id,
            name: toolToRestore.name,
            tool_type: toolToRestore.tool_type,
          },
        };
      }

      return {};
    },
    onSuccess: (payload) => {
      updateAgentTools(payload);
      setOpen(false);
    },
  });

  const handleDetach = useCallback(() => {
    if (toolType !== 'external_mcp') {
      trackClientSideEvent(AnalyticsEvent.DETACH_TOOL, {
        toolType,
        agentId,
        toolId: idToDetach,
      });
    } else {
      const tool = getToolToRestore(idToDetach);
      if (tool) {
        trackClientSideEvent(AnalyticsEvent.DETACH_MCP_SERVER_TOOL, {
          agentId,
          mcpServerName: tool.metadata_?.mcp?.server_name ?? '',
          mcpToolName: tool.name ?? '',
        });
      }
    }

    mutate({
      agentId,
      toolId: idToDetach,
    });
  }, [toolType, mutate, agentId, idToDetach, getToolToRestore]);

  return (
    <Dialog
      trigger={
        <Button
          size={size}
          color="secondary"
          preIcon={<LinkOffIcon />}
          label={t('DetachToolDialog.label')}
        />
      }
      isOpen={open}
      onOpenChange={setOpen}
      isConfirmBusy={isPending}
      onConfirm={handleDetach}
      title={t('DetachToolDialog.title')}
      confirmText={t('DetachToolDialog.confirm')}
    >
      <Typography>{t('DetachToolDialog.description')}</Typography>
    </Dialog>
  );
}

interface AttachDetachButtonProps {
  idToAttach: string;
  attachedId?: string;
  toolType: ToolType;
  toolName?: string;
  size?: 'default' | 'large' | 'small' | 'xsmall';
}

export function AttachDetachButton(props: AttachDetachButtonProps) {
  const { idToAttach, toolType, attachedId, toolName, size} = props;

  const { agentId } = useCurrentAgentMetaData();

  if (!agentId) {
    return null;
  }

  return (
    <HStack>
      {attachedId ? (
        <DetachToolDialog toolType={toolType} idToDetach={attachedId} size={size} />
      ) : (
        <AttachToolToAgentButton
          toolType={toolType}
          idToAttach={idToAttach}
          toolName={toolName}
          size={size}
        />
      )}
    </HStack>
  );
}
