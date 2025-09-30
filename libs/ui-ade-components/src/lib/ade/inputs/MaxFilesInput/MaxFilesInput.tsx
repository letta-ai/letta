'use client'
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { RawInput } from '@letta-cloud/ui-component-library';
import React, { useState, useEffect } from 'react';
import { useDebouncedValue } from '@mantine/hooks';

interface MaxFilesInputProps {
  defaultValue: string;
}

export function MaxFilesInput(props: MaxFilesInputProps) {
  const { defaultValue } = props;
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();
  const t = useTranslations('ADE/AdvancedSettings');

  const [invalidInputError, setInvalidInputError] = useState<boolean>(false);

  const [inputValue, setInputValue] = useState<string>(defaultValue);
  const [debouncedInput] = useDebouncedValue(inputValue, 500);

  useEffect(() => {
    if (debouncedInput === currentAgent.max_files_open?.toString()) {
      return;
    }

    if (debouncedInput === '') {
      setInvalidInputError(true);
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
    syncUpdateCurrentAgent((existing) => ({
      ...existing,
      max_files_open: debouncedInputAsInt,
    }));
  }, [debouncedInput, syncUpdateCurrentAgent, currentAgent.max_files_open]);

  return (
    <RawInput
      fullWidth
      size="small"
      errorMessage={
        invalidInputError
          ? t('AdvancedSettingsPanel.maxFilesOpen.invalidInput')
          : ''
      }
      name="maxFilesOpen"
      label={t('AdvancedSettingsPanel.maxFilesOpen.label')}
      infoTooltip={{
        text: t('AdvancedSettingsPanel.maxFilesOpen.tooltip'),
      }}
      value={inputValue}
      onChange={(e) => {
        setInputValue(e.target.value);
      }}
      placeholder={t('AdvancedSettingsPanel.maxFilesOpen.placeholder')}
    />
  );
}
