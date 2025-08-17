import React, { useCallback, useMemo } from 'react';
import {
  isMultiValue,
  PanelMainContent,
  RawCreatableAsyncSelect,
  Spinner,
} from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../hooks';
import {
  type AgentState,
  UseAgentsServiceRetrieveAgentKeyFn,
  useAgentsServiceModifyAgent,
} from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { useDebouncedCallback } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { AgentDescription } from '../AdvancedSettingsPanel/components/AgentDescription/AgentDescription';
import { cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';

function AgentTags() {
  const { id: agentId, tags: currentTags } = useCurrentAgent();

  const t = useTranslations('ADE/AgentSettingsPanel');

  const tags = useMemo(() => {
    return (currentTags || []).map((tag) => ({
      label: tag,
      value: tag,
    }));
  }, [currentTags]);

  const { mutate, isPending } = useAgentsServiceModifyAgent();

  const debouncedMutation = useDebouncedCallback(mutate, 500);

  const queryClient = useQueryClient();

  const handleUpdate = useCallback(
    async (tags: string[]) => {
      void queryClient.invalidateQueries({
        queryKey: cloudQueryKeys.templates.listTemplates,
        exact: false,
      });

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
              tags,
            },
          });

          return {
            ...oldData,
            tags,
          };
        },
      );
    },
    [debouncedMutation, agentId, queryClient],
  );

  return (
    <RawCreatableAsyncSelect
      fullWidth
      rightOfLabelContent={isPending ? <Spinner size="xsmall" /> : null}
      label={t('tags.label')}
      placeholder={t('tags.placeholder')}
      isMulti
      value={tags}
      infoTooltip={{
        text: t('tags.tooltip'),
      }}
      noOptionsMessage={() => t('tags.noOptions')}
      loadOptions={async () => {
        return [];
      }}
      onSelect={(value) => {
        if (!isMultiValue(value)) {
          return;
        }

        void handleUpdate(value.map((v) => v.value || '').filter((v) => !!v));
      }}
    />
  );
}

export function MetadataPanel() {
  return (
    <PanelMainContent>
      <AgentTags />
      <AgentDescription />
    </PanelMainContent>
  );
}
