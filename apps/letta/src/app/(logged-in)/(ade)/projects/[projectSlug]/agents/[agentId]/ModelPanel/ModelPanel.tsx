import React, { useEffect, useMemo, useState } from 'react';
import {
  PanelMainContent,
  type PanelTemplate,
  Alert,
  brandKeyToName,
  isBrandKey,
  brandKeyToLogo,
  RawSelect,
  isMultiValue,
  LoadingEmptyStatusComponent,
} from '@letta-web/component-library';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../hooks';
import { z } from 'zod';
import type { AgentState } from '@letta-web/letta-agents-api';
import {
  useModelsServiceListEmbeddingModels,
  useModelsServiceListModels,
} from '@letta-web/letta-agents-api';
import { useTranslations } from 'next-intl';
import { useDebouncedValue } from '@mantine/hooks';

interface SelectedModelType {
  icon: React.ReactNode;
  label: string;
  value: string;
}

interface ModelSelectorProps {
  llmConfig: AgentState['llm_config'];
}

function ModelSelector(props: ModelSelectorProps) {
  const { llmConfig } = props;
  const t = useTranslations('ADE/ModelPanel');
  const { syncUpdateCurrentAgent, error } = useSyncUpdateCurrentAgent();

  const { data: modelsList } = useModelsServiceListModels();

  const formattedModelsList = useMemo(() => {
    if (!modelsList) {
      return [];
    }

    const modelEndpointMap = modelsList.reduce((acc, model) => {
      acc[model.model_endpoint_type] = acc[model.model_endpoint_type] || [];

      acc[model.model_endpoint_type].push(model.model);

      return acc;
    }, {} as Record<string, string[]>);

    return Object.entries(modelEndpointMap).map(([key, value]) => ({
      icon: isBrandKey(key) ? brandKeyToLogo(key) : '',
      label: isBrandKey(key) ? brandKeyToName(key) : key,
      options: value.map((model) => ({
        icon: isBrandKey(key) ? brandKeyToLogo(key) : '',
        label: model,
        value: model,
      })),
    }));
  }, [modelsList]);

  const [modelState, setModelState] = useState<SelectedModelType>({
    icon: isBrandKey(llmConfig.model_endpoint_type)
      ? brandKeyToLogo(llmConfig.model_endpoint_type)
      : '',
    label: llmConfig.model,
    value: llmConfig.model,
  });

  const [debouncedModelState] = useDebouncedValue(modelState, 500);

  useEffect(() => {
    if (!modelsList) {
      return;
    }

    if (debouncedModelState.value !== llmConfig.model) {
      syncUpdateCurrentAgent(() => ({
        llm_config: modelsList.find(
          (model) => model.model === debouncedModelState.value
        ),
      }));
    }
  }, [
    llmConfig.model,
    debouncedModelState,
    modelsList,
    syncUpdateCurrentAgent,
  ]);

  return (
    <>
      {error && <Alert title={t('error')} variant="destructive" />}
      <RawSelect
        hideIconsOnOptions
        fullWidth
        onSelect={(value) => {
          if (isMultiValue(value)) {
            return;
          }

          setModelState({
            value: value?.value || '',
            label: value?.label || '',
            icon: value?.icon || '',
          });
        }}
        value={modelState}
        label={t('modelInput.label')}
        options={formattedModelsList}
      />
    </>
  );
}

interface EmbeddingConfig {
  embeddingConfig?: AgentState['embedding_config'];
}

function EmbeddingSelector(props: EmbeddingConfig) {
  const { embeddingConfig } = props;
  const t = useTranslations('ADE/ModelPanel');
  const { syncUpdateCurrentAgent, error } = useSyncUpdateCurrentAgent();

  const { data: embeddingModels } = useModelsServiceListEmbeddingModels();

  const formattedModelsList = useMemo(() => {
    if (!embeddingModels) {
      return [];
    }

    const modelEndpointMap = embeddingModels.reduce((acc, model) => {
      acc[model.embedding_endpoint_type] =
        acc[model.embedding_endpoint_type] || [];

      acc[model.embedding_endpoint_type].push(model.embedding_model);

      return acc;
    }, {} as Record<string, string[]>);

    return Object.entries(modelEndpointMap).map(([key, value]) => ({
      icon: isBrandKey(key) ? brandKeyToLogo(key) : '',
      label: isBrandKey(key) ? brandKeyToName(key) : key,
      options: value.map((model) => ({
        icon: isBrandKey(key) ? brandKeyToLogo(key) : '',
        label: model,
        value: model,
      })),
    }));
  }, [embeddingModels]);

  const [modelState, setModelState] = useState<SelectedModelType | undefined>(
    embeddingConfig
      ? {
          icon: isBrandKey(embeddingConfig.embedding_endpoint_type)
            ? brandKeyToLogo(embeddingConfig.embedding_endpoint_type)
            : '',
          label: embeddingConfig.embedding_model,
          value: embeddingConfig.embedding_model,
        }
      : undefined
  );

  const [debouncedModelState] = useDebouncedValue(modelState, 500);

  useEffect(() => {
    if (!embeddingModels || !debouncedModelState) {
      return;
    }

    if (debouncedModelState.value !== embeddingConfig?.embedding_model) {
      syncUpdateCurrentAgent(() => ({
        embedding_config: embeddingModels.find(
          (model) => model.embedding_model === debouncedModelState.value
        ),
      }));
    }
  }, [
    embeddingConfig?.embedding_model,
    debouncedModelState,
    embeddingModels,
    syncUpdateCurrentAgent,
  ]);

  return (
    <>
      {error && <Alert title={t('error')} variant="destructive" />}
      <RawSelect
        hideIconsOnOptions
        fullWidth
        onSelect={(value) => {
          if (isMultiValue(value)) {
            return;
          }

          setModelState({
            value: value?.value || '',
            label: value?.label || '',
            icon: value?.icon || '',
          });
        }}
        value={modelState}
        label={t('embeddingInput.label')}
        options={formattedModelsList}
      />
    </>
  );
}

export function ModelPanel() {
  const currentAgent = useCurrentAgent();

  if (!currentAgent.llm_config) {
    return <LoadingEmptyStatusComponent emptyMessage="" isLoading />;
  }

  return (
    <PanelMainContent>
      <ModelSelector llmConfig={currentAgent.llm_config} />
      <EmbeddingSelector embeddingConfig={currentAgent.embedding_config} />
    </PanelMainContent>
  );
}

export const modelTemplate = {
  templateId: 'model-details',
  content: ModelPanel,
  useGetTitle: () => 'Model',
  data: z.undefined(),
} satisfies PanelTemplate<'model-details'>;
