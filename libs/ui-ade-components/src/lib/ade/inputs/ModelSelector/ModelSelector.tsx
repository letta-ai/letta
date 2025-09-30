import type { AgentState } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import {
  brandKeyToLogo,
  Button,
  CopyButton,
  HStack,
  InfoIcon,
  isBrandKey,
  isMultiValue,
  Popover,
  RawSelect, TokenIcon,
  Typography,
  VStack
} from '@letta-cloud/ui-component-library';
import React, { useEffect, useMemo } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { getMergedLLMConfig } from '../../panels/AgentSettingsPanel/utils/getMergedLLMConfig/getMergedLLMConfig';
import {
  useSyncUpdateCurrentAgent,
} from '../../../hooks';
import { useADEState } from '../../../hooks/useADEState/useADEState';
import { useModelsOptions } from './hooks/useModelsOptions/useModelsOptions';
import { getBrandFromModelName } from '@letta-cloud/utils-shared';

interface LocalModelSelectorProps {
  llmConfig: AgentState['llm_config'];
}

export function ModelSelector(props: LocalModelSelectorProps) {
  const { llmConfig } = props;
  const { isLocal } = useADEState();
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

  /*
  What is this?

  If the user selects a model from the dropdown, we want to update the current agent's LLM configuration with the selected model.
  We debounce the value to avoid too many updates in a short time.

  Why is this needed?

  Sometimes the LLM Configs values are too large for the selected model, so we should adjust the current agent's LLM configuration to match the selected model one
   */
  useEffect(() => {
    if (!options) {
      return;
    }

    if (!debouncedValue) {
      return;
    }

    if (debouncedValue !== llmConfig.handle) {
      const selectedLLMConfig = getLLMConfigFromHandle(debouncedValue);

      if (!selectedLLMConfig) {
        return;
      }

      const modelName = selectedLLMConfig?.handle ? selectedLLMConfig.handle.split('/')[1] : selectedLLMConfig.model;

      syncUpdateCurrentAgent((prev) => {
        return {
          llm_config: {
            ...getMergedLLMConfig(selectedLLMConfig, prev.llm_config),
            model: modelName || selectedLLMConfig.model,
          },
        };
      });
    }
  }, [
    getLLMConfigFromHandle,
    llmConfig.handle,
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

  // Check if the current model is invalid (not found in available options)
  const isModelInvalid = useMemo(() => {
    if (isLoading || isLocal) {
      return false;
    }

    const currentHandle = llmConfig.handle;
    if (!currentHandle) {
      return false;
    }

    return !getSelectedOption(currentHandle);
  }, [isLoading, isLocal, llmConfig.handle, getSelectedOption]);

  return (
    <VStack fullWidth gap="small">
      <HStack align="end">
        <RawSelect
          fullWidth
          size="small"
          data-testid="model-selector"
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
        {!isLocal && (
          <Button
            size="small"
            hideLabel
            href="/models"
            target="_blank"
            preIcon={<TokenIcon />}
            color="secondary"
            label={t('viewSupportedModels')}
          />
        )}
      </HStack>
      {llmConfig?.handle && (
        <HStack fullWidth align="center">
          <Typography
            noWrap
            overflow="ellipsis"
            align="left"
            font="mono"
            color="muted"
            variant="body4"
          >
            {llmConfig.handle}
          </Typography>
          <CopyButton
            color="tertiary"
            size="small"
            copyButtonText="Copy model handle"
            textToCopy={llmConfig.handle}
            hideLabel
          />
        </HStack>
      )}
      {isModelInvalid && (
        <VStack border padding="small"  align="start" color="warning">
          <Typography variant="body3">
            {t('invalidModelWarning.message')}
          </Typography>
          <Popover
            triggerAsChild
            trigger={
              <Button
                size="xsmall"
                color="secondary"
                preIcon={<InfoIcon />}
                label={t('invalidModelWarning.moreInfo')}
              />
            }
          >
            <VStack gap="small" padding="medium" className="max-w-[300px]">
              <Typography variant="body2" bold>
                {t('invalidModelWarning.popover.title')}
              </Typography>
              <Typography variant="body3">
                {t('invalidModelWarning.popover.description')}
              </Typography>
            </VStack>
          </Popover>
        </VStack>
      )}
    </VStack>
  );
}
