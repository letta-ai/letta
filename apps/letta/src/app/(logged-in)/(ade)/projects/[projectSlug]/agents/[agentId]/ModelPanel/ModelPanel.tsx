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
} from '@letta-web/component-library';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../hooks';
import { z } from 'zod';
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

function ModelSelector() {
  const currentAgent = useCurrentAgent();
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
    icon: isBrandKey(currentAgent.llm_config.model_endpoint_type)
      ? brandKeyToLogo(currentAgent.llm_config.model_endpoint_type)
      : '',
    label: currentAgent.llm_config.model,
    value: currentAgent.llm_config.model,
  });

  const [debouncedModelState] = useDebouncedValue(modelState, 500);

  useEffect(() => {
    if (!modelsList) {
      return;
    }

    if (debouncedModelState.value !== currentAgent.llm_config.model) {
      syncUpdateCurrentAgent(() => ({
        llm_config: modelsList.find(
          (model) => model.model === debouncedModelState.value
        ),
      }));
    }
  }, [
    currentAgent.llm_config.model,
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

function EmbeddingSelector() {
  const currentAgent = useCurrentAgent();
  const t = useTranslations('ADE/ModelPanel');
  const { syncUpdateCurrentAgent, error } = useSyncUpdateCurrentAgent();

  const { data: embeddingModels } = useModelsServiceListEmbeddingModels();

  const currentEmbeddingConfig = useMemo(() => {
    return currentAgent.embedding_config;
  }, [currentAgent.embedding_config]);

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

  const [modelState, setModelState] = useState<SelectedModelType>({
    icon: isBrandKey(currentEmbeddingConfig.embedding_endpoint_type)
      ? brandKeyToLogo(currentEmbeddingConfig.embedding_endpoint_type)
      : '',
    label: currentEmbeddingConfig.embedding_model,
    value: currentEmbeddingConfig.embedding_model,
  });

  const [debouncedModelState] = useDebouncedValue(modelState, 500);

  useEffect(() => {
    if (!embeddingModels) {
      return;
    }

    if (
      debouncedModelState.value !==
      currentAgent.embedding_config.embedding_model
    ) {
      syncUpdateCurrentAgent(() => ({
        embedding_config: embeddingModels.find(
          (model) => model.embedding_model === debouncedModelState.value
        ),
      }));
    }
  }, [
    currentAgent.embedding_config.embedding_model,
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
  return (
    <PanelMainContent>
      <ModelSelector />
      <EmbeddingSelector />
    </PanelMainContent>
  );
}

export const modelTemplate = {
  templateId: 'model-details',
  content: ModelPanel,
  useGetTitle: () => 'Model',
  data: z.undefined(),
} satisfies PanelTemplate<'model-details'>;
