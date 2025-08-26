'use client';
import React, { useCallback, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Dialog,
  Typography,
} from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useQueryClient } from '@tanstack/react-query';

interface FlushSimulationSessionDialogProps {
  templateId: string;
  simulatedAgentId: string;
  trigger: React.ReactNode;
}

export function FlushSimulationSessionDialog(
  props: FlushSimulationSessionDialogProps,
) {
  const { templateId, simulatedAgentId, trigger } = props;
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('ADE/AgentSimulator');

  const {
    mutate: flushAgentSimulation,
    isPending,
    isError,
  } = webApi.simulatedAgents.flushSimulatedAgent.useMutation();

  const queryClient = useQueryClient();

  const handleFlushAgentSimulation = useCallback(() => {
    if (!simulatedAgentId) {
      return;
    }

    flushAgentSimulation(
      {
        params: {
          simulatedAgentId,
        },
      },
      {
        onSuccess: (res) => {
          if (!res.body) {
            return;
          }

          queryClient.setQueriesData(
            {
              queryKey:
                webApiQueryKeys.simulatedAgents.getDefaultSimulatedAgent(
                  templateId,
                ),
            },
            () => {
              return res;
            },
          );

          setIsOpen(false);
        },
      },
    );
  }, [simulatedAgentId, flushAgentSimulation, queryClient, templateId]);

  return (
    <Dialog
      isOpen={isOpen}
      errorMessage={isError ? t('FlushSimulationSessionDialog.error') : ''}
      trigger={
        trigger
      }
      onSubmit={(e) => {
        e.preventDefault();
        handleFlushAgentSimulation();
      }}
      isConfirmBusy={isPending}
      title={t('FlushSimulationSessionDialog.title')}
      confirmText={t('FlushSimulationSessionDialog.confirm')}
      onOpenChange={setIsOpen}
    >
      <Typography>{t('FlushSimulationSessionDialog.description')}</Typography>
    </Dialog>
  );
}
