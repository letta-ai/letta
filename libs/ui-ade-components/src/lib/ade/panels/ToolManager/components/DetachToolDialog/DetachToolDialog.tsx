import {
  type AgentState,
  type Tool,
  type ToolType,
  useAgentsServiceDetachTool,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useCurrentAgent } from '../../../../../hooks';
import { useOptimisticAgentTools } from '../../hooks/useOptimisticAgentTools/useOptimisticAgentTools';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import { useCallback, useState } from 'react';
import {
  Button,
  Dialog,
  LinkOffIcon,
  toast,
  Typography,
} from '@letta-cloud/ui-component-library';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

interface DetachToolDialogProps {
  toolType: ToolType;
  trigger?: React.ReactNode;
  idToDetach: string;
  size?: 'default' | 'large' | 'small' | 'xsmall';
  disabled?: boolean;
  hideLabel?: boolean;
  onClose?: () => void;
}

interface ToolWithMCPMetadata extends Tool {
  metadata_?: {
    mcp?: {
      server_name?: string;
    };
    [key: string]: unknown;
  } | null;
}

export function DetachToolDialog(props: DetachToolDialogProps) {
  const { idToDetach, trigger, toolType, size, disabled, hideLabel, onClose } =
    props;
  const { id: agentId } = useCurrentAgent();
  const { removeOptimisticTool, updateAgentTools, addOptimisticTool } =
    useOptimisticAgentTools(agentId);
  const queryClient = useQueryClient();

  const t = useTranslations('ToolActionsHeader');

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


  const [open, setOpen] = useState(false);
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
      setOpen(false);
      if (onClose) {
        onClose();
      }
      updateAgentTools(payload);
      toast.success(t('DetachToolDialog.success'));
    },
  });

  const handleDetach = useCallback(() => {
    if (toolType !== 'external_mcp') {
      trackClientSideEvent(AnalyticsEvent.DETACH_TOOL, {
        tool_type: toolType,
        agent_id: agentId,
        tool_id: idToDetach,
      });
    } else {
      const tool = getToolToRestore(idToDetach);
      if (tool) {
        trackClientSideEvent(AnalyticsEvent.DETACH_MCP_SERVER_TOOL, {
          agent_id: agentId,
          mcp_server_name: tool.metadata_?.mcp?.server_name ?? '',
          mcp_tool_name: tool.name ?? '',
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
      testId="detach-tool"
      trigger={
        trigger || (
          <Button
            size={size}
            color="secondary"
            preIcon={<LinkOffIcon />}
            label={t('DetachToolDialog.label')}
            hideLabel={hideLabel}
            disabled={disabled}
          />
        )
      }
      isOpen={open}
      isConfirmBusy={isPending}
      onConfirm={handleDetach}
      title={t('DetachToolDialog.title')}
      confirmText={t('DetachToolDialog.confirm')}
      onOpenChange={(open) => {
        setOpen(open);

        if (!open && onClose) {
          onClose();
        }
      }}
    >
      <Typography>
        {t('DetachToolDialog.descriptionBefore')}
        <Typography overrideEl="span" bold>
          {getToolToRestore(idToDetach)?.name || 'this tool'}
        </Typography>
        {t('DetachToolDialog.descriptionAfter')}
      </Typography>
    </Dialog>
  );
}
