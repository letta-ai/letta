import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { RawInput } from '@letta-cloud/ui-component-library';
import React, { useState, useEffect } from 'react';
import { useDebouncedValue } from '@mantine/hooks';

export function WindowCharLimitInput() {
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();
  const t = useTranslations('ADE/AdvancedSettings');

  const [invalidInputError, setInvalidInputError] = useState<boolean>(false);

  const [inputValue, setInputValue] = useState<string>(
    currentAgent.per_file_view_window_char_limit?.toString() || '',
  );
  const [debouncedInput] = useDebouncedValue(inputValue, 500);

  useEffect(() => {
    if (debouncedInput === '') {
      setInvalidInputError(true);
      return;
    }

    const debouncedInputAsInt = parseInt(debouncedInput, 10);

    if (isNaN(debouncedInputAsInt)) {
      setInvalidInputError(true);
      return;
    }

    if (debouncedInputAsInt <= 1000) {
      setInvalidInputError(true);
      return;
    }

    setInvalidInputError(false);
    syncUpdateCurrentAgent((existing) => ({
      ...existing,
      per_file_view_window_char_limit: debouncedInputAsInt,
    }));
  }, [debouncedInput, syncUpdateCurrentAgent]);

  return (
    <RawInput
      fullWidth
      size="small"
      errorMessage={
        invalidInputError
          ? t('AdvancedSettingsPanel.windowCharLimit.invalidInput')
          : ''
      }
      name="windowCharLimit"
      label={t('AdvancedSettingsPanel.windowCharLimit.label')}
      infoTooltip={{
        text: t('AdvancedSettingsPanel.windowCharLimit.tooltip'),
      }}
      value={inputValue}
      onChange={(e) => {
        setInputValue(e.target.value);
      }}
      placeholder={t('AdvancedSettingsPanel.windowCharLimit.placeholder')}
    />
  );
}
