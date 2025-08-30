import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../../hooks';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  RawSlider,
  tryParseSliderNumber,
} from '@letta-cloud/ui-component-library';

interface ContextWindowSliderProps {
  defaultContextWindow: number;
  maxContextWindow: number;
}

export const MIN_CONTEXT_WINDOW = 4000;

export function ContextWindowSlider(props: ContextWindowSliderProps) {
  const { defaultContextWindow, maxContextWindow } = props;
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();

  const [draftContextWindow, setDraftContextWindow] = useState<string>(
    `${defaultContextWindow || 0}`,
  );

  const t = useTranslations('ADE/AdvancedSettings');

  const handleContextWindowChange = useCallback(
    (value: number) => {
      if (!currentAgent.llm_config) {
        return;
      }

      syncUpdateCurrentAgent((existing) => ({
        llm_config: {
          ...existing.llm_config,
          context_window: value,
        },
      }));
    },
    [currentAgent.llm_config, syncUpdateCurrentAgent],
  );
  const parsedDraftContextWindow = useMemo(() => {
    return tryParseSliderNumber(draftContextWindow);
  }, [draftContextWindow]);

  return (
    <RawSlider
      fullWidth
      id="context-window-slider"
      label={t('ContextWindowSlider.label')}
      infoTooltip={{
        text: t('ContextWindowSlider.tooltip'),
      }}
      errorMessage={
        parsedDraftContextWindow === false
          ? t('ContextWindowSlider.error')
          : undefined
      }
      value={draftContextWindow}
      onValueChange={(value) => {
        // Update the visual state immediately while dragging
        setDraftContextWindow(value);
      }}
      onValueCommit={(value) => {
        // Only sync to app state when mouse is released
        const parsedNumber = tryParseSliderNumber(value[0].toString());
        if (parsedNumber !== false) {
          if (parsedNumber >= MIN_CONTEXT_WINDOW) {
            handleContextWindowChange(parsedNumber);
          }
        }
      }}
      min={MIN_CONTEXT_WINDOW}
      max={maxContextWindow}
    />
  );
}
