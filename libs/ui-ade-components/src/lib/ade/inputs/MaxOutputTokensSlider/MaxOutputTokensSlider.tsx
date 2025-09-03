import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RawSlider,
  tryParseSliderNumber,
} from '@letta-cloud/ui-component-library';

interface MaxTokensSliderProps {
  maxTokens: number; // The model's max tokens limit
  contextWindow: number; // Current context window for validation
  defaultMaxTokens: number;
}

export function MaxTokensSlider(props: MaxTokensSliderProps) {
  const { maxTokens, contextWindow, defaultMaxTokens } = props;
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();
  const t = useTranslations('ADE/AdvancedSettings');

  const [draftMaxTokens, setDraftMaxTokens] = useState<string>(
    `${currentAgent.llm_config?.max_tokens || defaultMaxTokens || 1024}`,
  );

  // Sync draft value when agent's max_tokens changes (e.g., when switch is toggled)
  useEffect(() => {
    if (currentAgent.llm_config?.max_tokens) {
      setDraftMaxTokens(`${currentAgent.llm_config.max_tokens}`);
    }
  }, [currentAgent.llm_config?.max_tokens]);

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

    if (sliderNumber < 1024 || sliderNumber > maxTokens) {
      return false;
    }

    // Check if exceeds context window
    if (sliderNumber > contextWindow) {
      return 'exceeds-context';
    }

    return sliderNumber;
  }, [draftMaxTokens, maxTokens, contextWindow]);

  return (
    <RawSlider
      id="max-tokens-slider"
      fullWidth
      label={t('MaxTokensSlider.label')}
      infoTooltip={{
        text: t('MaxTokensSlider.tooltip'),
      }}
      value={draftMaxTokens}
      errorMessage={
        parsedDraftMaxTokens === false
          ? t('MaxTokensSlider.error')
          : parsedDraftMaxTokens === 'exceeds-context'
          ? t('MaxTokensSlider.exceedsContextWindow', { contextWindow })
          : undefined
      }
      onValueChange={(value) => {
        // Update the visual state immediately while dragging
        setDraftMaxTokens(value);
      }}
      onValueCommit={(value) => {
        // Only sync to app state when mouse is released
        const parsedNumber = tryParseSliderNumber(value[0].toString());
        if (parsedNumber !== false && parsedNumber >= 1024 && parsedNumber <= contextWindow) {
          handleMaxTokensChange(parsedNumber);
        }
      }}
      min={1024}
      max={maxTokens}
    />
  );
}
