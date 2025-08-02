'use client';
import { useTranslations } from '@letta-cloud/translations';
import { useIsComposioConnected } from '../../hooks/useIsComposioConnected/useIsComposioConnected';
import {
  type ToolType,
  type AgentState,
  useAgentsServiceAttachTool,
  useAgentsServiceDetachTool,
  useToolsServiceAddComposioTool,
  useToolsServiceAddMcpTool,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
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

interface AttachComposioToolProps {
  idToAttach: string;
}

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
}

function AttachMCPTool(props: AttachMCPToolProps) {
  const { idToAttach } = props;
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
      preIcon={<AddLinkIcon />}
      busy={isPending}
      label={t('AttachMCPTool.label')}
      onClick={handleAttach}
    />
  );
}

interface AttachLocalToolProps {
  idToAttach: string;
  toolName?: string;
}

function AttachLocalTool(props: AttachLocalToolProps) {
  const { idToAttach, toolName } = props;
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
    mutate({
      agentId,
      toolId: idToAttach,
    });
  }, [agentId, mutate, idToAttach]);

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
}

function AttachToolToAgentButton(props: AttachToolToAgentButtonProps) {
  const { idToAttach, toolType, toolName } = props;

  switch (toolType) {
    case 'external_composio':
      return <AttachComposioTool idToAttach={idToAttach} />;
    case 'custom':
    case 'letta_multi_agent_core':
    case 'letta_core':
    case 'letta_memory_core':
    case 'letta_builtin':
    case 'letta_sleeptime_core':
      return <AttachLocalTool idToAttach={idToAttach} toolName={toolName} />;

    case 'external_mcp':
      return <AttachMCPTool idToAttach={idToAttach} />;

    default:
      return null;
  }
}

interface DetachToolDialogProps {
  idToDetach: string;
}

function DetachToolDialog(props: DetachToolDialogProps) {
  const { idToDetach } = props;
  const { id: agentId } = useCurrentAgent();
  const { removeOptimisticTool, updateAgentTools, addOptimisticTool } =
    useOptimisticAgentTools(agentId);
  const queryClient = useQueryClient();

  const t = useTranslations('ToolActionsHeader');

  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useAgentsServiceDetachTool({
    onError: (_error, _variables, context) => {
      if (context?.toolToRestore) {
        addOptimisticTool(context.toolToRestore);
      }
      toast.error(t('DetachToolDialog.error'));
    },
    onMutate: () => {
      const currentAgentState = queryClient.getQueryData<AgentState>(
        UseAgentsServiceRetrieveAgentKeyFn({
          agentId,
        }),
      );

      const toolToRestore = currentAgentState?.tools?.find(
        (tool) => tool.id === idToDetach,
      );

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
    mutate({
      agentId,
      toolId: idToDetach,
    });
  }, [idToDetach, agentId, mutate]);

  return (
    <Dialog
      trigger={
        <Button
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
}

export function AttachDetachButton(props: AttachDetachButtonProps) {
  const { idToAttach, toolType, attachedId, toolName } = props;

  const { agentId } = useCurrentAgentMetaData();

  if (!agentId) {
    return null;
  }

  return (
    <HStack>
      {attachedId ? (
        <DetachToolDialog idToDetach={attachedId} />
      ) : (
        <AttachToolToAgentButton
          toolType={toolType}
          idToAttach={idToAttach}
          toolName={toolName}
        />
      )}
    </HStack>
  );
}
