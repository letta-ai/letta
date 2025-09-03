import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import {
  RawSelect,
  isMultiValue,
  type OptionType,
} from '@letta-cloud/ui-component-library';
import type { MultiValue, SingleValue } from 'react-select';

export function ReasoningEffortDropdown() {
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();
  const t = useTranslations('ADE/AdvancedSettings');

  const reasoningEffortOptions: OptionType[] = useMemo(() => [
    { label: t('ReasoningEffortDropdown.minimal'), value: 'minimal' },
    { label: t('ReasoningEffortDropdown.low'), value: 'low' },
    { label: t('ReasoningEffortDropdown.medium'), value: 'medium' },
    { label: t('ReasoningEffortDropdown.high'), value: 'high' },
  ], [t]);

  const currentValue = useMemo(() => {
    if (!currentAgent.llm_config?.reasoning_effort) {
      return undefined;
    }

    return reasoningEffortOptions.find(
      (option) => option.value === currentAgent.llm_config?.reasoning_effort
    );
  }, [currentAgent.llm_config?.reasoning_effort, reasoningEffortOptions]);

  const handleReasoningEffortChange = useCallback(
    (value: MultiValue<OptionType> | SingleValue<OptionType>) => {
      if (!currentAgent.llm_config || isMultiValue(value) || !value?.value) {
        return;
      }

      syncUpdateCurrentAgent((existing) => ({
        llm_config: {
          ...existing.llm_config,
          reasoning_effort: value.value as 'minimal' | 'low' | 'medium' | 'high',
        },
      }));
    },
    [currentAgent.llm_config, syncUpdateCurrentAgent],
  );

  // Only show the dropdown if reasoning_effort has a value (not null or undefined)
  // null/undefined means the model doesn't support reasoning effort
  if (!currentAgent.llm_config?.reasoning_effort) {
    return null;
  }

  return (
    <RawSelect
      fullWidth
      size="small"
      data-testid="reasoning-effort-dropdown"
      label={t('ReasoningEffortDropdown.label')}
      infoTooltip={{
        text: t('ReasoningEffortDropdown.tooltip'),
      }}
      options={reasoningEffortOptions}
      onSelect={handleReasoningEffortChange}
      value={currentValue}
    />
  );
}
