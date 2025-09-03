import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import {
  RawSelect,
  isMultiValue,
  type OptionType,
} from '@letta-cloud/ui-component-library';
import type { MultiValue, SingleValue } from 'react-select';

export function VerbosityLevelDropdown() {
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();
  const t = useTranslations('ADE/AdvancedSettings');

  const verbosityLevelOptions: OptionType[] = useMemo(() => [
    { label: t('VerbosityLevelDropdown.low'), value: 'low' },
    { label: t('VerbosityLevelDropdown.medium'), value: 'medium' },
    { label: t('VerbosityLevelDropdown.high'), value: 'high' },
  ], [t]);

  const currentValue = useMemo(() => {
    if (!currentAgent.llm_config?.verbosity) {
      return undefined;
    }

    return verbosityLevelOptions.find(
      (option) => option.value === currentAgent.llm_config?.verbosity
    );
  }, [currentAgent.llm_config?.verbosity, verbosityLevelOptions]);

  const handleVerbosityLevelChange = useCallback(
    (value: MultiValue<OptionType> | SingleValue<OptionType>) => {
      if (!currentAgent.llm_config || isMultiValue(value) || !value?.value) {
        return;
      }

      syncUpdateCurrentAgent((existing) => ({
        llm_config: {
          ...existing.llm_config,
          verbosity: value.value as 'low' | 'medium' | 'high',
        },
      }));
    },
    [currentAgent.llm_config, syncUpdateCurrentAgent],
  );

  // Only show the dropdown if verbosity has a value (not null or undefined)
  // null/undefined means the model doesn't support verbosity control
  if (!currentAgent.llm_config?.verbosity) {
    return null;
  }

  return (
    <RawSelect
      fullWidth
      size="small"
      data-testid="verbosity-level-dropdown"
      label={t('VerbosityLevelDropdown.label')}
      infoTooltip={{
        text: t('VerbosityLevelDropdown.tooltip'),
      }}
      options={verbosityLevelOptions}
      onSelect={handleVerbosityLevelChange}
      value={currentValue}
    />
  );
}
