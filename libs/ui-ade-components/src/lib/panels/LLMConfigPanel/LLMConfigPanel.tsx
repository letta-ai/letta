import { useCurrentAgent } from '../../hooks';
import {
  LoadingEmptyStatusComponent,
  PanelMainContent,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useMemo } from 'react';
import { useModelsServiceListModels } from '@letta-cloud/sdk-core';
import { TemperatureSlider } from '../AdvancedSettingsPanel/components/TemperatureSlider/TemperatureSlider';
import {
  ContextWindowSlider,
  MIN_CONTEXT_WINDOW,
} from '../AdvancedSettingsPanel/components/ContextWindowSlider/ContextWindowSlider';
import { MaxTokensSlider } from '../AdvancedSettingsPanel/components/MaxOutputTokensSlider/MaxOutputTokensSlider';
import { MaxReasoningTokensSlider } from '../AdvancedSettingsPanel/components/MaxReasoningTokensSlider/MaxReasoningTokensSlider';

export function LLMConfigPanel() {
  const { data: modelsList } = useModelsServiceListModels();
  const currentAgent = useCurrentAgent();

  const currentBaseModel = useMemo(() => {
    if (!currentAgent.llm_config?.model) {
      return null;
    }

    return modelsList?.find(
      (val) => val.model === currentAgent.llm_config?.model,
    );
  }, [currentAgent.llm_config, modelsList]);

  if (!currentAgent.llm_config || !modelsList) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage=""
        loaderVariant="grower"
        isLoading
      />
    );
  }

  return (
    <PanelMainContent>
      <VStack>
        <TemperatureSlider
          defaultTemperature={currentAgent.llm_config.temperature || 1}
        />
        {currentBaseModel && (
          <ContextWindowSlider
            maxContextWindow={currentBaseModel.context_window}
            defaultContextWindow={
              currentAgent.llm_config.context_window || MIN_CONTEXT_WINDOW
            }
          />
        )}
        {currentBaseModel?.max_tokens && (
          <MaxTokensSlider
            maxContextWindow={
              currentAgent.llm_config.context_window || MIN_CONTEXT_WINDOW
            }
            defaultMaxTokens={
              currentAgent.llm_config.max_tokens || currentBaseModel.max_tokens
            }
          />
        )}
        {currentBaseModel?.max_tokens &&
          currentBaseModel.model.startsWith('claude-3-7-sonnet') && (
            <MaxReasoningTokensSlider
              maxTokens={
                currentAgent.llm_config.max_tokens ||
                currentBaseModel.max_tokens
              }
              defaultMaxReasoningTokens={
                currentAgent.llm_config.max_reasoning_tokens || 0
              }
            />
          )}
      </VStack>
    </PanelMainContent>
  );
}
