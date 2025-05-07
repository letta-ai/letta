import type { AgentState } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import {
  brandKeyToLogo,
  isBrandKey,
  isMultiValue,
  RawSelect,
} from '@letta-cloud/ui-component-library';
import React, { useEffect, useMemo } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { getMergedLLMConfig } from '../utils/getMergedLLMConfig/getMergedLLMConfig';
import {
  useCurrentAgentMetaData,
  useSyncUpdateCurrentAgent,
} from '../../../hooks';
import { useModelsOptions } from './hooks/useModelsOptions/useModelsOptions';
import { getBrandFromModelName } from '@letta-cloud/utils-shared';

interface LocalModelSelectorProps {
  llmConfig: AgentState['llm_config'];
}

export function ModelSelector(props: LocalModelSelectorProps) {
  const { llmConfig } = props;
  const { isLocal } = useCurrentAgentMetaData();
  const { getLLMConfigFromHandle, getSelectedOption, options, isLoading } =
    useModelsOptions({
      isLocal,
    });

  const t = useTranslations('ADE/AgentSettingsPanel/ModelSelector');

  const [selectedModelValue, setSelectedModelValue] = React.useState<string>(
    llmConfig.handle || '',
  );

  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();

  const [debouncedValue] = useDebouncedValue(selectedModelValue, 500);

  useEffect(() => {
    if (!options) {
      return;
    }

    if (!debouncedValue) {
      return;
    }

    if (debouncedValue !== llmConfig.model) {
      const selectedLLMConfig = getLLMConfigFromHandle(debouncedValue);

      if (!selectedLLMConfig) {
        return;
      }

      syncUpdateCurrentAgent((prev) => {
        return {
          llm_config: getMergedLLMConfig(selectedLLMConfig, prev.llm_config),
        };
      });
    }
  }, [
    getLLMConfigFromHandle,
    llmConfig.model,
    debouncedValue,
    syncUpdateCurrentAgent,
    options,
  ]);

  const value = useMemo(() => {
    if (isLoading) {
      const brand = getBrandFromModelName(llmConfig.handle || '') || 'ollama';

      return {
        label: llmConfig.model || '',
        value: llmConfig.handle || '',
        icon: isBrandKey(brand) ? brandKeyToLogo(brand) : '',
      };
    }

    return getSelectedOption(selectedModelValue);
  }, [
    isLoading,
    getSelectedOption,
    selectedModelValue,
    llmConfig.handle,
    llmConfig.model,
  ]);

  return (
    <RawSelect
      fullWidth
      placeholder={t('placeholder')}
      isLoading={isLoading}
      infoTooltip={{
        text: t('tooltip'),
      }}
      options={options}
      onSelect={(value) => {
        if (isMultiValue(value) || !value?.value) {
          return;
        }

        setSelectedModelValue(value.value);
      }}
      value={value}
      label={t('label')}
    />
  );
}
