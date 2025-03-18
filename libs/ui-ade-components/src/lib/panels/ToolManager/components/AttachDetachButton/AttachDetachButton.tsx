import { useTranslations } from '@letta-cloud/translations';
import { useIsComposioConnected } from '../../hooks/useIsComposioConnected/useIsComposioConnected';
import {
  type AgentState,
  type ToolType,
  useAgentsServiceAttachTool,
  useAgentsServiceDetachTool,
  UseAgentsServiceRetrieveAgentKeyFn,
  useToolsServiceAddComposioTool,
  useToolsServiceAddMcpTool,
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
import { useCurrentAgent } from '../../../../hooks';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { get } from 'lodash-es';

interface AttachComposioToolProps {
  idToAttach: string;
}

function AttachComposioTool(props: AttachComposioToolProps) {
  const { idToAttach } = props;
  const t = useTranslations('ToolActionsHeader');
  const { isConnected: isComposioConnected } = useIsComposioConnected();
  const { mutateAsync: addComposioTool } = useToolsServiceAddComposioTool();
  const { mutateAsync: attachToolToAgent } = useAgentsServiceAttachTool({
    onError: () => {
      toast.error(t('AttachComposioTool.GenericSDKError'));
    },
  });

  const { id: agentId } = useCurrentAgent();

  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const handleAddTool = useCallback(async () => {
    try {
      setIsPending(true);

      let toolIdToAdd = '';

      const addComposioId = await addComposioTool({
        composioActionName: idToAttach,
      });

      toolIdToAdd = addComposioId.id || '';

      const response = await attachToolToAgent({
        agentId,
        toolId: toolIdToAdd,
      });
      toast.success(t('AttachComposioTool.success'));
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId: agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            tools: response.tools,
          };
        },
      );
    } catch (e) {
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
  }, [addComposioTool, agentId, attachToolToAgent, queryClient, t, idToAttach]);

  return (
    <Button
      color="tertiary"
      size="small"
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
  const { mutateAsync: addMCPTool } = useToolsServiceAddMcpTool();
  const { mutateAsync: attachToolToAgent } = useAgentsServiceAttachTool({
    onError: () => {
      toast.error(t('AttachMCPTool.error'));
    },
    onSuccess: () => {
      toast.success(t('AttachMCPTool.success'));
    },
  });

  const { id: agentId } = useCurrentAgent();

  const queryClient = useQueryClient();

  const handleAttach = useCallback(async () => {
    const toolIdToAdd = await addMCPTool({
      mcpServerName,
      mcpToolName,
    });

    const response = await attachToolToAgent({
      agentId,
      toolId: toolIdToAdd.id || '',
    });

    queryClient.setQueriesData<AgentState | undefined>(
      {
        queryKey: UseAgentsServiceRetrieveAgentKeyFn({
          agentId: agentId,
        }),
      },
      (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          ...oldData,
          tools: response.tools,
        };
      },
    );
  }, [
    addMCPTool,
    agentId,
    attachToolToAgent,
    queryClient,
    mcpServerName,
    mcpToolName,
  ]);

  return (
    <Button
      color="tertiary"
      size="small"
      preIcon={<AddLinkIcon />}
      label={t('AttachMCPTool.label')}
      onClick={handleAttach}
    />
  );
}

interface AttachLocalToolProps {
  idToAttach: string;
}

function AttachLocalTool(props: AttachLocalToolProps) {
  const { idToAttach } = props;
  const t = useTranslations('ToolActionsHeader');
  const queryClient = useQueryClient();

  const { mutate } = useAgentsServiceAttachTool({
    onError: () => {
      toast.error(t('AttachLocalTool.error'));
    },
    onSuccess: (payload) => {
      toast.success(t('AttachLocalTool.success'));
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId: payload.id,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return payload;
        },
      );
    },
  });

  const { id: agentId } = useCurrentAgent();

  const handleAttach = useCallback(async () => {
    mutate({
      agentId,
      toolId: idToAttach,
    });
  }, [agentId, mutate, idToAttach]);

  return (
    <Button
      color="tertiary"
      size="small"
      preIcon={<AddLinkIcon />}
      label={t('AttachLocalTool.label')}
      onClick={handleAttach}
    />
  );
}

interface AttachToolToAgentButtonProps {
  idToAttach: string;
  toolType: ToolType;
}

function AttachToolToAgentButton(props: AttachToolToAgentButtonProps) {
  const { idToAttach, toolType } = props;

  switch (toolType) {
    case 'external_composio':
      return <AttachComposioTool idToAttach={idToAttach} />;
    case 'custom':
    case 'letta_multi_agent_core':
    case 'letta_core':
    case 'letta_memory_core':
      return <AttachLocalTool idToAttach={idToAttach} />;

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

  const t = useTranslations('ToolActionsHeader');

  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useAgentsServiceDetachTool({
    onError: () => {
      toast.error(t('DetachToolDialog.error'));
    },
    onSuccess: (payload) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId: agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return payload;
        },
      );

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
          color="tertiary"
          size="small"
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
}

export function AttachDetachButton(props: AttachDetachButtonProps) {
  const { idToAttach, toolType, attachedId } = props;

  return (
    <HStack>
      {attachedId ? (
        <DetachToolDialog idToDetach={attachedId} />
      ) : (
        <AttachToolToAgentButton toolType={toolType} idToAttach={idToAttach} />
      )}
    </HStack>
  );
}
