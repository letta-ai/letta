import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../hooks';
import {
  Dialog,
  FormField,
  FormProvider,
  HStack,
  TextArea,
  tryParseSliderNumber,
  Typography,
  useForm,
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
  Button,
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
import { useDebouncedValue } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/rbac';

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

interface TemperatureSliderProps {
  defaultTemperature: number;
}

function TemperatureSlider(props: TemperatureSliderProps) {
  const { defaultTemperature } = props;
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();
  const t = useTranslations('ADE/AdvancedSettings');

  const [draftTemperature, setDraftTemperature] = useState<string>(
    `${defaultTemperature || 0}`,
  );

  const handleTemperatureChange = useCallback(
    (value: number) => {
      if (!currentAgent.llm_config) {
        return;
      }

      syncUpdateCurrentAgent((existing) => ({
        llm_config: {
          ...existing.llm_config,
          temperature: value,
        },
      }));
    },
    [currentAgent.llm_config, syncUpdateCurrentAgent],
  );

  const parsedDraftTemperature = useMemo(() => {
    const sliderNumber = tryParseSliderNumber(draftTemperature);

    if (sliderNumber === false) {
      return false;
    }

    if (sliderNumber < 0 || sliderNumber > 1) {
      return false;
    }

    return sliderNumber;
  }, [draftTemperature]);

  return (
    <RawSlider
      fullWidth
      label={t('TemperatureSlider.label')}
      value={draftTemperature}
      errorMessage={
        parsedDraftTemperature === false
          ? t('TemperatureSlider.error')
          : undefined
      }
      onValueChange={(value) => {
        setDraftTemperature(value);

        const parsedNumber = tryParseSliderNumber(value);

        if (parsedNumber) {
          handleTemperatureChange(parsedNumber);
        }
      }}
      min={0}
      max={1}
      step={0.01}
    />
  );
}

interface ContextWindowSliderProps {
  defaultContextWindow: number;
  maxContextWindow: number;
}

const MIN_CONTEXT_WINDOW = 4000;

function ContextWindowSlider(props: ContextWindowSliderProps) {
  const { defaultContextWindow, maxContextWindow } = props;
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();

  const [draftContextWindow, setDraftContextWindow] = useState<string>(
    `${defaultContextWindow || 0}`,
  );

  const t = useTranslations('ADE/AdvancedSettings');

  const handleContextWindowChange = useCallback(
    (value: number) => {
      if (!currentAgent.llm_config) {
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
  const parsedDraftContextWindow = useMemo(() => {
    return tryParseSliderNumber(draftContextWindow);
  }, [draftContextWindow]);

  return (
    <RawSlider
      fullWidth
      label={t('ContextWindowSlider.label')}
      errorMessage={
        parsedDraftContextWindow === false
          ? t('ContextWindowSlider.error')
          : undefined
      }
      value={draftContextWindow}
      onValueChange={(value) => {
        setDraftContextWindow(value);

        const parsedNumber = tryParseSliderNumber(value);
        if (parsedNumber !== false) {
          if (parsedNumber >= MIN_CONTEXT_WINDOW) {
            handleContextWindowChange(parsedNumber);
          }
        }
      }}
      min={MIN_CONTEXT_WINDOW}
      max={maxContextWindow}
    />
  );
}

const systemPromptEditorForm = z.object({
  system: z.string(),
});

type SystemPromptEditorFormType = z.infer<typeof systemPromptEditorForm>;

interface SystemPromptEditorDialogProps {
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  system: string;
}

function SystemPromptEditorDialog(props: SystemPromptEditorDialogProps) {
  const { isExpanded, setIsExpanded, system } = props;
  const { mutate, isPending, isError } = useAgentsServiceModifyAgent();
  const queryClient = useQueryClient();
  const currentAgent = useCurrentAgent();
  const t = useTranslations('ADE/AgentSettingsPanel');
  const form = useForm<SystemPromptEditorFormType>({
    resolver: zodResolver(systemPromptEditorForm),
    defaultValues: {
      system,
    },
  });

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  const handleSubmit = useCallback(
    (data: SystemPromptEditorFormType) => {
      mutate(
        {
          agentId: currentAgent.id,
          requestBody: {
            system: data.system,
          },
        },
        {
          onSuccess: (_r) => {
            queryClient.setQueriesData<AgentState | undefined>(
              {
                queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                  agentId: currentAgent.id,
                }),
              },
              (oldData) => {
                if (!oldData) {
                  return oldData;
                }

                return {
                  ...oldData,
                  system: data.system,
                };
              },
            );
            setIsExpanded(false);
          },
        },
      );
    },
    [currentAgent.id, mutate, queryClient, setIsExpanded],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        size="full"
        isOpen={isExpanded}
        isConfirmBusy={isPending}
        confirmText={t('SystemPromptEditor.dialog.save')}
        onSubmit={form.handleSubmit(handleSubmit)}
        onOpenChange={setIsExpanded}
        hideFooter={!canUpdateAgent}
        errorMessage={isError ? t('SystemPromptEditor.error') : ''}
        title={t('SystemPromptEditor.dialog.title')}
      >
        <VStack collapseHeight flex gap="form">
          <FormField
            render={({ field }) => {
              return (
                <VStack fullHeight>
                  <HStack gap="xlarge" align="center" justify="spaceBetween">
                    <div>
                      <Alert
                        title={t('SystemPromptEditor.dialog.info')}
                        variant="info"
                      />
                    </div>
                    <Typography
                      noWrap
                      font="mono"
                      color="muted"
                      variant="body2"
                    >
                      {t('SystemPromptEditor.dialog.characterCount', {
                        count: field.value.length,
                      })}
                    </Typography>
                  </HStack>
                  <TextArea
                    fullWidth
                    flex
                    fullHeight
                    disabled={!canUpdateAgent}
                    autosize={false}
                    hideLabel
                    label={t('SystemPromptEditor.label')}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                    }}
                    value={field.value}
                  />
                </VStack>
              );
            }}
            name="system"
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

function SystemPromptEditor() {
  const t = useTranslations('ADE/AgentSettingsPanel');
  const [isExpanded, setIsExpanded] = useState(false);

  const currentAgent = useCurrentAgent();

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  return (
    <>
      {isExpanded && (
        <SystemPromptEditorDialog
          system={currentAgent.system || ''}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
        />
      )}
      <Button
        disabled={!canUpdateAgent}
        fullWidth
        onClick={() => {
          setIsExpanded(true);
        }}
        color="secondary"
        label={t('SystemPromptEditor.trigger')}
      />
    </>
  );
}

export function AdvancedSettingsPanel() {
  const currentAgent = useCurrentAgent();
  const { data: modelsList } = useModelsServiceListModels();
  const t = useTranslations('ADE/AdvancedSettings');

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
      <VStack fullWidth paddingTop="small" gap="form" justify="start">
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
        <SystemPromptEditor />
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
