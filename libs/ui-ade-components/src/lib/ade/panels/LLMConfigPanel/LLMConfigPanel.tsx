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
import { ReasoningEffortDropdown } from '../../inputs/ReasoningEffortDropdown/ReasoningEffortDropdown';
import { VerbosityLevelDropdown } from '../../inputs/VerbosityLevelDropdown/VerbosityLevelDropdown';
import { MaxReasoningTokensSliderContainer } from '../../inputs/MaxReasoningTokensSlider/MaxReasoningTokensSliderContainer';

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

  // Cloud-only hint: admin-configured default context window
  const defaultContextWindowFromCloud = useMemo(() => {
    if (!currentBaseModel) return undefined;
    const rec = currentBaseModel as Record<string, unknown>;
    const val = rec['default_context_window'];
    return typeof val === 'number' ? val : undefined;
  }, [currentBaseModel]);

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
      <VStack gap="large">
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
              // Prefer org-configured default if provided by cloud models router
              // otherwise fall back to current agent value
              defaultContextWindowFromCloud ??
              currentAgent.llm_config.context_window ??
              MIN_CONTEXT_WINDOW
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
        <MaxReasoningTokensSliderContainer llmConfig={currentAgent.llm_config} maxTokens={currentBaseModel?.max_tokens} />
      </VStack>
  );
}
