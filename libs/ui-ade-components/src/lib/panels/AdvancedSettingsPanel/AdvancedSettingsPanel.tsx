import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../hooks';
import {
  LoadingEmptyStatusComponent,
  PanelMainContent,
  TabGroup,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useMemo } from 'react';
import { useModelsServiceListModels } from '@letta-cloud/sdk-core';
import { TemperatureSlider } from './components/TemperatureSlider/TemperatureSlider';
import {
  ContextWindowSlider,
  MIN_CONTEXT_WINDOW,
} from './components/ContextWindowSlider/ContextWindowSlider';
import { MaxTokensSlider } from './components/MaxOutputTokensSlider/MaxOutputTokensSlider';
import { MessageBufferAutoclearSwitch } from './components/MessageBufferAutoclearSwitch/MessageBufferAutoclearSwitch';
import { EmbeddingConfiguration } from './components/EmbeddingConfiguration/EmbeddingConfiguration';
import { MaxReasoningTokensSlider } from './components/MaxReasoningTokensSlider/MaxReasoningTokensSlider';
import { SystemPromptEditor } from './components/SystemPromptEditor/SystemPromptEditor';
import { AgentDescription } from './components/AgentDescription/AgentDescription';
import { AgentType } from './components/AgentType/AgentType';
import { MessageBufferLengthSlider } from './components/MessageBufferLengthSlider/MessageBufferLengthSlider';
import { SleeptimeAgentFrequencyInput } from './components/SleeptimeAgentFrequencyInput/SleeptimeAgentFrequencyInput';

function LLMConfigView() {
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
              currentAgent.llm_config.max_tokens || currentBaseModel.max_tokens
            }
            defaultMaxReasoningTokens={
              currentAgent.llm_config.max_reasoning_tokens || 0
            }
          />
        )}
    </VStack>
  );
}

function EmbeddingConfigView() {
  return <EmbeddingConfiguration />;
}

function AgentAdvancedSettingsView() {
  const { agentType, isTemplate, isSleeptimeAgent } = useCurrentAgentMetaData();

  return (
    <VStack gap="large">
      <VStack>
        <MessageBufferAutoclearSwitch />
        <SystemPromptEditor />
      </VStack>
      <AgentType />
      {agentType === 'voice_convo_agent' && <MessageBufferLengthSlider />}
      {isSleeptimeAgent && agentType !== 'voice_convo_agent' && (
        <SleeptimeAgentFrequencyInput />
      )}
      {!isTemplate && <AgentDescription />}
    </VStack>
  );
}

interface ViewSwitchProps {
  view: Views;
}

function ViewSwitch({ view }: ViewSwitchProps) {
  switch (view) {
    case 'agent':
      return <AgentAdvancedSettingsView />;
    case 'llm-config':
      return <LLMConfigView />;
    case 'embedding-config':
      return <EmbeddingConfigView />;
    default:
      return null;
  }
}

type Views = 'agent' | 'embedding-config' | 'llm-config';

export function AdvancedSettingsPanel() {
  const t = useTranslations('ADE/AdvancedSettings');
  useModelsServiceListModels();

  const [view, setView] = React.useState<Views>('agent');

  return (
    <PanelMainContent>
      <VStack fullWidth gap="form" justify="start">
        <TabGroup
          size="xsmall"
          extendBorder
          items={[
            {
              label: t('views.agent'),
              value: 'agent',
            },
            {
              label: t('views.llmConfig'),
              value: 'llm-config',
            },
            {
              label: t('views.embeddingConfig'),
              value: 'embedding-config',
            },
          ]}
          value={view}
          onValueChange={(value) => setView(value as Views)}
        />
        <ViewSwitch view={view} />
      </VStack>
    </PanelMainContent>
  );
}
