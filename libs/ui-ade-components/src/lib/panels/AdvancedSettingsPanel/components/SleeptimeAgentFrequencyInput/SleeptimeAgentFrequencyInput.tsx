import { useCurrentGroup } from '../../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { RawInput, toast } from '@letta-cloud/ui-component-library';
import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import {
  UseGroupsServiceRetrieveGroupKeyFn,
  useGroupsServiceModifyGroup,
  type Group,
} from '@letta-cloud/sdk-core';

export function SleeptimeAgentFrequencyInput() {
  const currentGroup = useCurrentGroup();
  const t = useTranslations('ADE/AdvancedSettings');
  const queryClient = useQueryClient();

  const currentSleeptimeAgentFrequency = useMemo(() => {
    if (typeof currentGroup?.sleeptime_agent_frequency === 'number') {
      return currentGroup.sleeptime_agent_frequency.toString();
    } else {
      return undefined;
    }
  }, [currentGroup?.sleeptime_agent_frequency]);

  const [inputValue, setInputValue] = useState<string | undefined>(
    currentSleeptimeAgentFrequency,
  );
  const [debouncedInput] = useDebouncedValue(inputValue, 500);

  useEffect(() => {
    if (currentSleeptimeAgentFrequency !== undefined) {
      setInputValue(currentSleeptimeAgentFrequency);
    }
  }, [currentSleeptimeAgentFrequency]);

  const { mutate: updateGroup } = useGroupsServiceModifyGroup({
    onSuccess: (data) => {
      if (!currentGroup || !debouncedInput) {
        return;
      }
      const queryKey = UseGroupsServiceRetrieveGroupKeyFn({
        groupId: currentGroup.id,
      });

      queryClient.setQueryData(queryKey, (oldData: Group | undefined) => {
        if (!oldData) {
          return data;
        }
        return {
          ...oldData,
          sleeptime_agent_frequency: parseInt(debouncedInput, 10),
        };
      });

      void queryClient.invalidateQueries({
        queryKey: queryKey,
      });
    },
    onError: () => {
      setInputValue(currentSleeptimeAgentFrequency);
      toast.error(t('AdvancedSettingsPanel.sleeptimeAgentFrequency.error'));
    },
  });

  useEffect(() => {
    if (
      currentGroup?.id &&
      debouncedInput &&
      debouncedInput !== currentSleeptimeAgentFrequency
    ) {
      updateGroup({
        groupId: currentGroup.id,
        requestBody: {
          manager_config: {
            manager_type: 'sleeptime',
            sleeptime_agent_frequency: parseInt(debouncedInput, 10),
          },
        },
      });
    }
  }, [
    debouncedInput,
    currentGroup,
    currentSleeptimeAgentFrequency,
    updateGroup,
  ]);

  return (
    <RawInput
      fullWidth
      name="sleeptimeAgentFrequency"
      label={t('AdvancedSettingsPanel.sleeptimeAgentFrequency.label')}
      infoTooltip={{
        text: t('AdvancedSettingsPanel.sleeptimeAgentFrequency.tooltip'),
      }}
      type="number"
      value={inputValue}
      onChange={(e) => {
        setInputValue(e.target.value);
      }}
    />
  );
}
