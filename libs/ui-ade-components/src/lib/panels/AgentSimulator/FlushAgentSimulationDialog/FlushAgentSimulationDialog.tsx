import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgentMetaData } from '../../../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentSimulatedAgent } from '../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import {
  type GetAgentTemplateSimulatorSessionResponseBody,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import {
  Button,
  Dialog,
  FlushIcon,
  toast,
  Typography,
} from '@letta-cloud/ui-component-library';

export function FlushSimulationSessionDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('ADE/AgentSimulator');
  const queryClient = useQueryClient();
  const { agentId: agentTemplateId } = useCurrentAgentMetaData();
  const { agentSession } = useCurrentSimulatedAgent();

  const { mutate: createSession, isPending: isCreatingNewSession } =
    webApi.agentTemplates.createAgentTemplateSimulatorSession.useMutation({
      onSuccess: (response) => {
        toast.success(t('FlushSimulationSessionDialog.success'));

        queryClient.setQueriesData<GetAgentTemplateSimulatorSessionResponseBody>(
          {
            queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateSession({
              agentTemplateId,
            }),
          },
          () => {
            return {
              status: 200,
              body: response.body,
            };
          },
        );

        setIsOpen(false);
      },
    });

  const { mutate, isPending: isDeletingSession } =
    webApi.agentTemplates.deleteAgentTemplateSimulatorSession.useMutation({
      onSuccess: async () => {
        createSession({
          params: {
            agentTemplateId,
          },
          body: {
            memoryVariables: agentSession?.body.memoryVariables || {},
            toolVariables: agentSession?.body.toolVariables || {},
          },
        });
      },
      onError: () => {
        toast.error(t('FlushSimulationSessionDialog.error'));
      },
    });

  const isPending = useMemo(() => {
    return isCreatingNewSession || isDeletingSession;
  }, [isCreatingNewSession, isDeletingSession]);

  const handleFlushSession = useCallback(() => {
    mutate({
      params: {
        agentTemplateId,
        agentSessionId: agentSession?.body.id || '',
      },
    });
  }, [agentSession?.body.id, agentTemplateId, mutate]);

  return (
    <Dialog
      isConfirmBusy={isPending}
      isOpen={isOpen}
      trigger={
        <Button
          size="small"
          color="tertiary"
          preIcon={<FlushIcon />}
          hideLabel
          label={t('FlushSimulationSessionDialog.trigger')}
        />
      }
      title={t('FlushSimulationSessionDialog.title')}
      confirmText={t('FlushSimulationSessionDialog.confirm')}
      onConfirm={handleFlushSession}
      onOpenChange={setIsOpen}
    >
      <Typography>{t('FlushSimulationSessionDialog.description')}</Typography>
    </Dialog>
  );
}
