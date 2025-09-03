import {
  Alert,
  brandKeyToLogo,
  brandKeyToName,
  isBrandKey,
  isMultiValue,
  type OptionType,
  RawInput,
  RawSelect,
} from '@letta-cloud/ui-component-library';
import React, { useEffect, useMemo, useState } from 'react';
import {
  useCurrentAgent,
  useSyncUpdateCurrentAgent,
} from '../../../hooks';
import { useADEState } from '../../../hooks/useADEState/useADEState';
import { useModelsServiceListEmbeddingModels } from '@letta-cloud/sdk-core';
import type { AgentState } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { useDebouncedValue } from '@mantine/hooks';
import { DEFAULT_EMBEDDING_MODEL } from '@letta-cloud/types';

interface EmbeddingConfig {
  embeddingConfig: AgentState['embedding_config'];
}

export function EmbeddingSelector(props: EmbeddingConfig) {
  const { embeddingConfig } = props;
  const { isLocal } = useADEState();
  const t = useTranslations('ADE/EmbeddingConfiguration');
  const { syncUpdateCurrentAgent, error } = useSyncUpdateCurrentAgent();

  const { data: embeddingModels } = useModelsServiceListEmbeddingModels(
    {},
    undefined,
    {
      enabled: isLocal,
    },
  );

  const formattedModelsList = useMemo(() => {
    if (!embeddingModels) {
      return [];
    }

    const modelEndpointMap = embeddingModels.reduce(
      (acc, model) => {
        acc[model.embedding_endpoint_type] =
          acc[model.embedding_endpoint_type] || [];

        acc[model.embedding_endpoint_type].push(model.embedding_model);

        return acc;
      },
      {} as Record<string, string[]>,
    );

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
      : undefined,
  );

  const [debouncedModelState] = useDebouncedValue(modelState, 500);

  useEffect(() => {
    if (!embeddingModels || !debouncedModelState) {
      return;
    }

    if (debouncedModelState.value !== embeddingConfig?.embedding_model) {
      syncUpdateCurrentAgent(() => ({
        embedding_config: embeddingModels.find(
          (model) => model.embedding_model === debouncedModelState.value,
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
        size="small"
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

interface EmbeddingSelectorWrapperProps {
  embeddingConfig?: AgentState['embedding_config'];
}

function EmbeddingSelectorWrapper(props: EmbeddingSelectorWrapperProps) {
  const { embeddingConfig } = props;
  const t = useTranslations('ADE/EmbeddingConfiguration');

  if (!embeddingConfig) {
    return (
      <RawInput
        fullWidth
        size="small"
        label={t('embeddingInput.label')}
        placeholder={t('embeddingInput.loading')}
        description={t('embeddingInput.description')}
        disabled
      />
    )
  }

  return <EmbeddingSelector embeddingConfig={embeddingConfig} />;

}

export function EmbeddingConfiguration() {
  const currentAgent = useCurrentAgent();
  const { isLocal } = useADEState();
  const t = useTranslations('ADE/EmbeddingConfiguration');


  return (
    <>
      {isLocal ? (
        <EmbeddingSelectorWrapper embeddingConfig={currentAgent.embedding_config} />
      ) : (
        <RawInput
          fullWidth
          size="small"
          label={t('embeddingInput.label')}
          value={DEFAULT_EMBEDDING_MODEL}
          description={t('embeddingInput.description')}
          disabled
        />
      )}

      <RawInput
        fullWidth
        size="small"
        label={t('embeddingDimensions.label')}
        value={currentAgent.embedding_config?.embedding_dim || '0'}
        type="number"
        disabled
      />
      <RawInput
        fullWidth
        size="small"
        label={t('embeddingChunkSize.label')}
        value={currentAgent.embedding_config?.embedding_chunk_size || '0'}
        type="number"
        disabled
      />
    </>
  );
}
