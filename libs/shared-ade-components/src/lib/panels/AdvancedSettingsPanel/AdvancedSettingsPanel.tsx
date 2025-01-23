import { useTranslations } from '@letta-cloud/translations';
import {
  useCurrentAgent,
  useCurrentAgentMetaData,
  useSyncUpdateCurrentAgent,
} from '../../hooks';
import {
  RawCreatableAsyncSelect,
  Spinner,
} from '@letta-cloud/component-library';
import type { OptionType } from '@letta-cloud/component-library';

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
} from '@letta-cloud/component-library';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AgentState,
  UseAgentsServiceRetrieveAgentKeyFn,
  useAgentsServiceModifyAgent,
  useModelsServiceListEmbeddingModels,
  useModelsServiceListModels,
} from '@letta-cloud/letta-agents-api';
import { useDebouncedCallback, useDebouncedValue } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { webApiQueryKeys } from '@letta-cloud/web-api-client';

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

function AgentTags() {
  const { id: agentId, tags: currentTags } = useCurrentAgent();

  const t = useTranslations('ADE/AgentSettingsPanel');

  const tags = useMemo(() => {
    return (currentTags || []).map((tag) => ({
      label: tag,
      value: tag,
    }));
  }, [currentTags]);

  const { mutate, isPending } = useAgentsServiceModifyAgent();

  const debouncedMutation = useDebouncedCallback(mutate, 500);

  const queryClient = useQueryClient();

  const handleUpdate = useCallback(
    async (tags: string[]) => {
      void queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.agentTemplates.listAgentTemplates,
        exact: false,
      });

      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          debouncedMutation({
            agentId,
            requestBody: {
              tags,
            },
          });

          return {
            ...oldData,
            tags,
          };
        },
      );
    },
    [debouncedMutation, agentId, queryClient],
  );

  return (
    <RawCreatableAsyncSelect
      fullWidth
      rightOfLabelContent={isPending ? <Spinner size="xsmall" /> : null}
      label={t('tags.label')}
      placeholder={t('tags.placeholder')}
      isMulti
      value={tags}
      noOptionsMessage={() => t('tags.noOptions')}
      loadOptions={async () => {
        return [];
      }}
      onSelect={(value) => {
        if (!isMultiValue(value)) {
          return;
        }

        void handleUpdate(value.map((v) => v.value || '').filter((v) => !!v));
      }}
    />
  );
}

const MIN_CONTEXT_WINDOW = 4000;

export function AdvancedSettingsPanel() {
  const { isTemplate } = useCurrentAgentMetaData();
  const currentAgent = useCurrentAgent();
  const { data: modelsList } = useModelsServiceListModels();
  const t = useTranslations('ADE/AdvancedSettings');

  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();

  const [draftContextWindow, setDraftContextWindow] = useState<number>(
    currentAgent.llm_config?.context_window || MIN_CONTEXT_WINDOW,
  );

  const currentBaseModel = useMemo(() => {
    if (!currentAgent.llm_config?.model) {
      return null;
    }

    return modelsList?.find(
      (val) => val.model === currentAgent.llm_config?.model,
    );
  }, [currentAgent.llm_config, modelsList]);

  const handleContextWindowChange = useCallback(
    (value: number) => {
      if (!currentAgent.llm_config) {
        return;
      }

      if (MIN_CONTEXT_WINDOW > value) {
        return;
      }

      syncUpdateCurrentAgent((existing) => ({
        llm_config: {
          ...existing.llm_config,
          context_window: value,
        },
      }));
    },
    [currentAgent.llm_config, syncUpdateCurrentAgent],
  );

  useEffect(() => {
    if (!currentBaseModel || !currentAgent.llm_config) {
      return;
    }

    if (
      currentBaseModel.context_window < currentAgent.llm_config.context_window
    ) {
      setDraftContextWindow(currentBaseModel.context_window);
      handleContextWindowChange(currentBaseModel.context_window);
    }
  }, [currentAgent.llm_config, currentBaseModel, handleContextWindowChange]);

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
      <VStack fullWidth paddingTop="small" gap="form" justify="start">
        {!isTemplate && <AgentTags />}

        <RawSlider
          fullWidth
          label={t('contextWindowController.label')}
          value={[draftContextWindow]}
          errorMessage={
            draftContextWindow < MIN_CONTEXT_WINDOW
              ? t('contextWindowController.errors.tooSmall')
              : ''
          }
          onValueChange={([value]) => {
            setDraftContextWindow(value);

            if (value < MIN_CONTEXT_WINDOW) {
              return;
            }

            handleContextWindowChange(value);
          }}
          min={MIN_CONTEXT_WINDOW}
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
