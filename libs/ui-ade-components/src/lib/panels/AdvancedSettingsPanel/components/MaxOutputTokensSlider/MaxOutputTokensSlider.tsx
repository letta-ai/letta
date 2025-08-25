import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo, useState } from 'react';
import {
  RawSlider,
  tryParseSliderNumber,
} from '@letta-cloud/ui-component-library';

interface MaxTokensSliderProps {
  maxContextWindow: number;
  defaultMaxTokens: number;
}

export function MaxTokensSlider(props: MaxTokensSliderProps) {
  const { maxContextWindow, defaultMaxTokens } = props;
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();
  const t = useTranslations('ADE/AdvancedSettings');

  const [draftMaxTokens, setDraftMaxTokens] = useState<string>(
    `${defaultMaxTokens || 1024}`,
  );

  const handleMaxTokensChange = useCallback(
    (value: number) => {
      if (!currentAgent.llm_config) {
        return;
      }

      syncUpdateCurrentAgent((existing) => ({
        llm_config: {
          ...existing.llm_config,
          max_tokens: value,
        },
      }));
    },
    [currentAgent.llm_config, syncUpdateCurrentAgent],
  );

  const parsedDraftMaxTokens = useMemo(() => {
    const sliderNumber = tryParseSliderNumber(draftMaxTokens);

    if (sliderNumber === false) {
      return false;
    }

    if (sliderNumber < 1024 || sliderNumber > maxContextWindow) {
      return false;
    }

    return sliderNumber;
  }, [draftMaxTokens, maxContextWindow]);

  return (
    <RawSlider
      id="max-tokens-slider"
      fullWidth
      label={t('MaxTokensSlider.label')}
      value={draftMaxTokens}
      errorMessage={
        parsedDraftMaxTokens === false ? t('MaxTokensSlider.error') : undefined
      }
      onValueChange={(value) => {
        setDraftMaxTokens(value);

        const parsedNumber = tryParseSliderNumber(value);

        if (parsedNumber) {
          handleMaxTokensChange(parsedNumber);
        }
      }}
      min={1024}
      max={maxContextWindow}
    />
  );
}
