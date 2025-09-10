import { useTranslations } from '@letta-cloud/translations';
import { Dialog, toast } from '@letta-cloud/ui-component-library';
import {
  type AgentState, isAgentState,
  useAgentsServiceModifyApproval,
  UseAgentsServiceRetrieveAgentKeyFn
} from '@letta-cloud/sdk-core';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgent } from '../../../../../hooks';

interface EnableHITLForToolDialogProps {
  trigger: React.ReactNode;
  toolName: string;
}

export function EnableHITLForToolDialog(props: EnableHITLForToolDialogProps) {
  const { trigger, toolName } = props;
  const { id: agentId } = useCurrentAgent();
  const t = useTranslations('ADE/Tools.EnableHITLForToolDialog');
  const queryClient = useQueryClient();

  const { mutate } = useAgentsServiceModifyApproval({
    onMutate: () => {
      const oldState = queryClient.getQueryData(
        UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
      );

      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            tool_rules: [
              ...(oldData.tool_rules || []),
              {
                tool_name: toolName,
                type: 'requires_approval',
              },
            ],
          };
        },
      );


      return oldState;
    },
    onSuccess: () => {
      toast.success(t('success', {
        toolName
      }))
    },
    onError: (_error, _variables, context) => {
      if (isAgentState(context)) {
        queryClient.setQueriesData<AgentState | undefined>(
          {
            queryKey: UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
          },
          () => context,
        );
      }

      toast.error(t('error', {
        toolName
      }));

    }
  });

  const onConfirm = useCallback(() => {
    mutate({
      agentId,
      toolName,
      requiresApproval: true,
    });
  }, [mutate, agentId, toolName]);

  return (
    <Dialog trigger={trigger} onConfirm={onConfirm} title={t('title')}>
      {t('description', { toolName })}
    </Dialog>
  );
}
