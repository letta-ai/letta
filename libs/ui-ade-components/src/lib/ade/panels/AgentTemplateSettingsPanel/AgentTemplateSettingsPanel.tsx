import React from 'react';
import {
  LoadingEmptyStatusComponent,
  PanelMainContent,
  VStack,
} from '@letta-cloud/ui-component-library';

import { useCurrentAgent } from '../../../hooks';
import { ModelSelector } from '../../inputs/ModelSelector/ModelSelector';
import { SystemPromptEditor } from '../../inputs/SystemPromptEditor/SystemPromptEditor';
import { ReasoningSwitch } from '../../inputs/ReasoningSwitch/ReasoningSwitch';
import { LLMConfigPanel } from '../LLMConfigPanel/LLMConfigPanel';
import { EmbeddingConfiguration } from '../../inputs/EmbeddingConfiguration/EmbeddingConfiguration';

export function AgentTemplateSettingsPanel() {
  const currentAgent = useCurrentAgent();

  if (!currentAgent.llm_config) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage=""
        hideText
        loaderVariant="grower"
        isLoading
      />
    );
  }

  return (
    <PanelMainContent>
      <VStack gap="small">
        <ModelSelector llmConfig={currentAgent.llm_config} />
      </VStack>
      <VStack gap="large">
        <ReasoningSwitch />
        <SystemPromptEditor />
      </VStack>
      {/* LLM Configuration */}
      <LLMConfigPanel />

      {/* Embedding Configuration */}
      <EmbeddingConfiguration />
    </PanelMainContent>
  );
}
