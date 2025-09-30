'use client'
import { useCurrentGroup } from '../../../hooks';
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

interface SleeptimeAgentFrequencyInputInnerProps {
  defaultSleeptimeFrequency: string;
}

function SleeptimeAgentFrequencyInputInner(
  props: SleeptimeAgentFrequencyInputInnerProps,
) {
  const currentGroup = useCurrentGroup();
  const { defaultSleeptimeFrequency } = props;
  const t = useTranslations('ADE/AdvancedSettings');
  const queryClient = useQueryClient();

  const [invalidInputError, setInvalidInputError] = useState<boolean>(false);

  const [inputValue, setInputValue] = useState<string>(
    defaultSleeptimeFrequency,
  );
  const [debouncedInput] = useDebouncedValue(inputValue, 500);

  const { mutate: updateGroup } = useGroupsServiceModifyGroup({
    onSuccess: () => {
      if (!currentGroup || !debouncedInput) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: UseGroupsServiceRetrieveGroupKeyFn({
          groupId: currentGroup.id,
        }),
      });
    },
    onError: () => {
      setInputValue(defaultSleeptimeFrequency);
      toast.error(t('AdvancedSettingsPanel.sleeptimeAgentFrequency.error'));
    },
  });

  useEffect(() => {
    if (!debouncedInput || !inputValue) {
      return;
    }

    const debouncedInputAsInt = parseInt(debouncedInput, 10);

    if (isNaN(debouncedInputAsInt)) {
      setInvalidInputError(true);
      return;
    }

    if (debouncedInputAsInt <= 0) {
      setInvalidInputError(true);
      return;
    }
    setInvalidInputError(false);

    if (currentGroup?.id && debouncedInput !== defaultSleeptimeFrequency) {
      queryClient.setQueryData(
        UseGroupsServiceRetrieveGroupKeyFn({
          groupId: currentGroup.id,
        }),
        (oldData: Group | undefined) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            sleeptime_agent_frequency: debouncedInputAsInt,
          };
        },
      );

      updateGroup({
        groupId: currentGroup.id,
        requestBody: {
          manager_config: {
            manager_type: 'sleeptime',
            sleeptime_agent_frequency: debouncedInputAsInt,
          },
        },
      });
    }
  }, [
    queryClient,
    debouncedInput,
    currentGroup,
    updateGroup,
    inputValue,
    defaultSleeptimeFrequency,
  ]);

  return (
    <RawInput
      fullWidth
      size="small"
      errorMessage={
        invalidInputError
          ? t('AdvancedSettingsPanel.sleeptimeAgentFrequency.invalidInput')
          : ''
      }
      name="sleeptimeAgentFrequency"
      label={t('AdvancedSettingsPanel.sleeptimeAgentFrequency.label')}
      infoTooltip={{
        text: t('AdvancedSettingsPanel.sleeptimeAgentFrequency.tooltip'),
      }}
      value={inputValue}
      onChange={(e) => {
        setInputValue(e.target.value);
      }}
    />
  );
}

export function SleeptimeAgentFrequencyInput() {
  const currentGroup = useCurrentGroup();

  const currentSleeptimeAgentFrequency = useMemo(() => {
    if (typeof currentGroup?.sleeptime_agent_frequency === 'number') {
      return currentGroup.sleeptime_agent_frequency.toString();
    } else {
      return undefined;
    }
  }, [currentGroup?.sleeptime_agent_frequency]);

  if (typeof currentSleeptimeAgentFrequency !== 'string') {
    return null;
  }

  return (
    <SleeptimeAgentFrequencyInputInner
      defaultSleeptimeFrequency={currentSleeptimeAgentFrequency}
    />
  );
}
