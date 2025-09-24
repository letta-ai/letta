'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  type ToolType,
  useAgentsServiceAttachTool,
  useToolsServiceAddMcpTool,
} from '@letta-cloud/sdk-core';


import {
  AddLinkIcon,
  Button,
  HStack,
  toast,
} from '@letta-cloud/ui-component-library';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../../../../hooks';
import { useCallback } from 'react';
import { useOptimisticAgentTools } from '../../hooks/useOptimisticAgentTools/useOptimisticAgentTools';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { DetachToolDialog } from '../DetachToolDialog/DetachToolDialog';


interface AttachMCPToolProps {
  idToAttach: string;
  size?: 'default' | 'large' | 'small' | 'xsmall';
  disabled?: boolean;
  hideLabel?: boolean;
}

function AttachMCPTool(props: AttachMCPToolProps) {
  const { idToAttach, size, disabled, hideLabel } = props;
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
      agent_id: agentId,
      mcp_server_name: mcpServerName,
      mcp_tool_name: mcpToolName,
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
      hideLabel={hideLabel}
      onClick={handleAttach}
      disabled={disabled}
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
      toast.success(t('AttachLocalTool.success'));
    },
  });

  const handleAttach = useCallback(async () => {
    trackClientSideEvent(AnalyticsEvent.ATTACH_TOOL, {
      tool_type: toolType,
      agent_id: agentId,
      tool_id: idToAttach,
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
  disabled?: boolean;
  hideLabel?: boolean;
}

function AttachToolToAgentButton(props: AttachToolToAgentButtonProps) {
  const { idToAttach, toolType, toolName, size, disabled, hideLabel } = props;

  switch (toolType) {
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
      return (
        <AttachMCPTool
          idToAttach={idToAttach}
          size={size}
          disabled={disabled}
          hideLabel={hideLabel}
        />
      );

    default:
      return null;
  }
}

interface AttachDetachButtonProps {
  idToAttach: string;
  attachedId?: string;
  toolType: ToolType;
  toolName?: string;
  size?: 'default' | 'large' | 'small' | 'xsmall';
  disabled?: boolean;
  hideLabel?: boolean;
}

export function AttachDetachButton(props: AttachDetachButtonProps) {
  const {
    idToAttach,
    toolType,
    attachedId,
    toolName,
    size,
    disabled,
    hideLabel,
  } = props;

  const { agentId } = useCurrentAgentMetaData();

  if (!agentId) {
    return null;
  }

  return (
    <HStack>
      {attachedId ? (
        <DetachToolDialog
          toolType={toolType}
          idToDetach={attachedId}
          size={size}
          disabled={disabled}
          hideLabel={hideLabel}
        />
      ) : (
        <AttachToolToAgentButton
          toolType={toolType}
          idToAttach={idToAttach}
          toolName={toolName}
          size={size}
          disabled={disabled}
          hideLabel={hideLabel}
        />
      )}
    </HStack>
  );
}
