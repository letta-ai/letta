import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo, useState } from 'react';
import {
  RawSlider,
  tryParseSliderNumber,
} from '@letta-cloud/ui-component-library';

interface MaxReasoningTokensSliderProps {
  maxTokens: number;
  defaultMaxReasoningTokens: number;
}

export function MaxReasoningTokensSlider(props: MaxReasoningTokensSliderProps) {
  const { maxTokens, defaultMaxReasoningTokens } = props;
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();
  const t = useTranslations('ADE/AdvancedSettings');

  const [draftMaxReasoningTokens, setDraftMaxReasoningTokens] =
    useState<string>(
      `${currentAgent.llm_config?.max_reasoning_tokens || defaultMaxReasoningTokens}`,
    );

  const handleMaxReasoningTokensChange = useCallback(
    (value: number) => {
      if (!currentAgent.llm_config) {
        return;
      }

      syncUpdateCurrentAgent((existing) => ({
        llm_config: {
          ...existing.llm_config,
          max_reasoning_tokens: value,
          enable_reasoner: value !== 0,
          temperature: value !== 0 ? 1 : existing.llm_config.temperature,
        },
      }));
    },
    [currentAgent.llm_config, syncUpdateCurrentAgent],
  );

  const parsedDraftMaxReasoningTokens = useMemo(() => {
    const sliderNumber = tryParseSliderNumber(draftMaxReasoningTokens);

    if (sliderNumber === false) {
      return false;
    }

    if (
      (sliderNumber < 1024 || sliderNumber > maxTokens) &&
      sliderNumber !== 0
    ) {
      return false;
    }

    return sliderNumber;
  }, [draftMaxReasoningTokens, maxTokens]);

  return (
    <RawSlider
      fullWidth
      label={t('MaxReasoningTokensSlider.label')}
      value={draftMaxReasoningTokens}
      errorMessage={
        parsedDraftMaxReasoningTokens === false
          ? t('MaxReasoningTokensSlider.error')
          : undefined
      }
      onValueChange={(value) => {
        // Update the visual state immediately while dragging
        setDraftMaxReasoningTokens(value);
      }}
      onValueCommit={(value) => {
        // Only sync to app state when mouse is released
        const parsedNumber = tryParseSliderNumber(value[0].toString());
        if (parsedNumber !== false && (parsedNumber === 0 || (parsedNumber >= 1024 && parsedNumber <= maxTokens))) {
          handleMaxReasoningTokensChange(parsedNumber);
        }
      }}
      min={0}
      max={maxTokens}
    />
  );
}
