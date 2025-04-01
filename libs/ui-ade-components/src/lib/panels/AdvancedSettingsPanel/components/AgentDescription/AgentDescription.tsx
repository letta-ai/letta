import React, { useCallback, useState } from 'react';
import { useCurrentAgentMetaData } from '../../../../hooks';
import { useCurrentAgent } from '../../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import {
  type AgentState,
  useAgentsServiceModifyAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useDebouncedCallback } from '@mantine/hooks';
import { webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useQueryClient } from '@tanstack/react-query';
import { useADEPermissions } from '../../../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { RawTextArea, Spinner } from '@letta-cloud/ui-component-library';

export function AgentDescription() {
  const { agentId } = useCurrentAgentMetaData();

  const { description } = useCurrentAgent();
  const [localDescription, setLocalDescription] = useState(description || '');

  const t = useTranslations('ADE/AgentSettingsPanel');

  const { mutate, isPending } = useAgentsServiceModifyAgent();

  const debouncedMutation = useDebouncedCallback((args) => {
    mutate(args);
    void queryClient.invalidateQueries({
      queryKey: webApiQueryKeys.agentTemplates.listAgentTemplates,
      exact: false,
    });
  }, 500);

  const queryClient = useQueryClient();

  const handleUpdate = useCallback(
    async (description: string) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          debouncedMutation({
            agentId,
            requestBody: {
              description,
            },
          });

          return {
            ...oldData,
            description,
          };
        },
      );
    },
    [debouncedMutation, agentId, queryClient],
  );

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  return (
    <RawTextArea
      onChange={(e) => {
        setLocalDescription(e.target.value);
        void handleUpdate(e.target.value);
      }}
      disabled={!canUpdateAgent}
      rightOfLabelContent={isPending ? <Spinner size="xsmall" /> : null}
      placeholder={t('TemplateDescription.placeholder')}
      rows={2}
      value={localDescription || ''}
      fullWidth
      variant="secondary"
      resize="none"
      autosize
      maxRows={4}
      minRows={2}
      label={t('TemplateDescription.label')}
    />
  );
}
