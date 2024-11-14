import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../hooks';
import type { OptionType } from '@letta-web/component-library';
import {
  Alert,
  brandKeyToLogo,
  brandKeyToName,
  isBrandKey,
  isMultiValue,
  LoadingEmptyStatusComponent,
  PanelMainContent,
  RawInput,
  RawSelect,
  RawSlider,
  VStack,
} from '@letta-web/component-library';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AgentState,
  useModelsServiceListEmbeddingModels,
  useModelsServiceListModels,
} from '@letta-web/letta-agents-api';
import { useDebouncedValue } from '@mantine/hooks';

interface EmbeddingConfig {
  embeddingConfig?: AgentState['embedding_config'];
}

export function EmbeddingSelector(props: EmbeddingConfig) {
  const { embeddingConfig } = props;
  const t = useTranslations('ADE/AgentSettingsPanel');
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

  const [modelState, setModelState] = useState<OptionType | undefined>(
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

function AdvancedSettingsPanel() {
  const currentAgent = useCurrentAgent();
  const { data: modelsList } = useModelsServiceListModels();
  const t = useTranslations('ADE/AdvancedSettings');

  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();

  const currentBaseModel = useMemo(() => {
    if (!currentAgent.llm_config?.model) {
      return null;
    }

    return modelsList?.find(
      (val) => val.model === currentAgent.llm_config?.model
    );
  }, [currentAgent.llm_config, modelsList]);

  const handleContextWindowChange = useCallback(
    (value: number) => {
      syncUpdateCurrentAgent((existing) => ({
        llm_config: {
          ...existing.llm_config,
          context_window: value,
        },
      }));
    },
    [syncUpdateCurrentAgent]
  );

  useEffect(() => {
    if (!currentBaseModel || !currentAgent.llm_config) {
      return;
    }

    if (
      currentBaseModel.context_window < currentAgent.llm_config.context_window
    ) {
      handleContextWindowChange(currentBaseModel.context_window);
    }
  }, [currentAgent.llm_config, currentBaseModel, handleContextWindowChange]);

  if (!currentAgent.llm_config || !modelsList) {
    return <LoadingEmptyStatusComponent emptyMessage="" isLoading />;
  }

  return (
    <PanelMainContent>
      <VStack fullWidth paddingTop="small" gap="form" justify="start">
        <RawSlider
          fullWidth
          label={t('contextWindowController.label')}
          value={[currentAgent.llm_config.context_window]}
          onValueChange={([value]) => {
            handleContextWindowChange(value);
          }}
          min={0}
          max={currentBaseModel?.context_window || 10000}
        />
        <EmbeddingSelector embeddingConfig={currentAgent.embedding_config} />
        <RawInput
          fullWidth
          label={t('AdvancedSettingsPanel.embeddingDimensions.label')}
          value={currentAgent.embedding_config?.embedding_dim || '0'}
          type="number"
          disabled
        />
        <RawInput
          fullWidth
          label={t('AdvancedSettingsPanel.embeddingChunkSize.label')}
          value={currentAgent.embedding_config?.embedding_chunk_size || '0'}
          type="number"
          disabled
        />
      </VStack>
    </PanelMainContent>
  );
}

export const advancedSettingsPanel = {
  templateId: 'advanced-settings',
  content: AdvancedSettingsPanel,
  useGetTitle: () => {
    const t = useTranslations('ADE/AdvancedSettings');

    return t('title');
  },
  data: z.undefined(),
};
