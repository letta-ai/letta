import { useCurrentAgent } from '../../../hooks';
import {
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useMemo } from 'react';
import { useModelsServiceListModels } from '@letta-cloud/sdk-core';
import { TemperatureSlider } from '../../inputs/TemperatureSlider/TemperatureSlider';
import {
  ContextWindowSlider,
  MIN_CONTEXT_WINDOW,
} from '../../inputs/ContextWindowSlider/ContextWindowSlider';
import { MaxTokensSlider } from '../../inputs/MaxOutputTokensSlider/MaxOutputTokensSlider';
import { EnableMaxTokensSwitch } from '../../inputs/EnableMaxTokensSwitch/EnableMaxTokensSwitch';
import { MaxReasoningTokensSlider } from '../../inputs/MaxReasoningTokensSlider/MaxReasoningTokensSlider';
import { ReasoningEffortDropdown } from '../../inputs/ReasoningEffortDropdown/ReasoningEffortDropdown';
import { VerbosityLevelDropdown } from '../../inputs/VerbosityLevelDropdown/VerbosityLevelDropdown';

export function LLMConfigPanel() {
  const { data: modelsList } = useModelsServiceListModels();
  const currentAgent = useCurrentAgent();

  const currentBaseModel = useMemo(() => {
    if (!currentAgent.llm_config?.model) {
      return null;
    }

    const handleMatch = modelsList?.find(
      (val) => val.handle === currentAgent.llm_config?.handle,
    );

    if (handleMatch) {
      return handleMatch;
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
      <VStack>
        <ReasoningEffortDropdown />
        <VerbosityLevelDropdown />
        <TemperatureSlider
          defaultTemperature={currentAgent.llm_config.temperature || 1}
        />
        {currentBaseModel && (
          <ContextWindowSlider
            key={currentBaseModel.context_window}
            maxContextWindow={currentBaseModel.context_window}
            defaultContextWindow={
              currentAgent.llm_config.context_window || MIN_CONTEXT_WINDOW
            }
          />
        )}
        <EnableMaxTokensSwitch
          defaultMaxTokens={currentBaseModel?.max_tokens || 4096}
        />
        <div
          className={`transition-all duration-300 ease-in-out ${
            currentAgent.llm_config.max_tokens !== null &&
            currentAgent.llm_config.max_tokens !== undefined
              ? 'max-h-[200px] opacity-100'
              : 'max-h-0 opacity-0 overflow-hidden'
          }`}
        >
          <MaxTokensSlider
            maxTokens={currentBaseModel?.max_tokens || 4096}
            contextWindow={
              currentAgent.llm_config.context_window || MIN_CONTEXT_WINDOW
            }
            defaultMaxTokens={
              currentAgent.llm_config.max_tokens ||
              currentBaseModel?.max_tokens ||
              4096
            }
          />
        </div>
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
  );
}
