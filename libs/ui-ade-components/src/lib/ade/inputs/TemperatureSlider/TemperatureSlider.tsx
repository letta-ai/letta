import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo, useState } from 'react';
import {
  RawSlider,
  tryParseSliderNumber,
} from '@letta-cloud/ui-component-library';

interface TemperatureSliderProps {
  defaultTemperature: number;
}

export function TemperatureSlider(props: TemperatureSliderProps) {
  const { defaultTemperature } = props;
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();
  const t = useTranslations('ADE/AdvancedSettings');

  const [draftTemperature, setDraftTemperature] = useState<string>(
    `${defaultTemperature || 0}`,
  );

  const handleTemperatureChange = useCallback(
    (value: number) => {
      if (!currentAgent.llm_config) {
        return;
      }

      syncUpdateCurrentAgent((existing) => ({
        llm_config: {
          ...existing.llm_config,
          temperature: value,
        },
      }));
    },
    [currentAgent.llm_config, syncUpdateCurrentAgent],
  );

  const parsedDraftTemperature = useMemo(() => {
    const sliderNumber = tryParseSliderNumber(draftTemperature);

    if (sliderNumber === false) {
      return false;
    }

    if (sliderNumber < 0 || sliderNumber > 1) {
      return false;
    }

    return sliderNumber;
  }, [draftTemperature]);

  return (
    <RawSlider
      fullWidth
      id="temperature-slider"
      label={t('TemperatureSlider.label')}
      infoTooltip={{
        text: t('TemperatureSlider.tooltip'),
      }}
      value={draftTemperature}
      errorMessage={
        parsedDraftTemperature === false
          ? t('TemperatureSlider.error')
          : undefined
      }
      onValueChange={(value) => {
        // Update the visual state immediately while dragging
        setDraftTemperature(value);
      }}
      onValueCommit={(value) => {
        // Only sync to app state when mouse is released
        const parsedNumber = tryParseSliderNumber(value[0].toString());
        if (parsedNumber !== false && parsedNumber >= 0 && parsedNumber <= 1) {
          handleTemperatureChange(parsedNumber);
        }
      }}
      min={0}
      max={1}
      step={0.01}
    />
  );
}
