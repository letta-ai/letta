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
  HStack,
  RawInput,
  Button,
  CogIcon,
  CopyButton,
  Typography,
  VStack,
  RawTextArea,
  Dialog,
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
import { UpdateNameDialog } from '../shared/UpdateAgentNameDialog/UpdateAgentNameDialog';
import { useAgentBaseTypeName } from '../hooks/useAgentBaseNameType/useAgentBaseNameType';
import { useUpdateMemory } from '../hooks/useUpdateMemory/useUpdateMemory';
import { nicelyFormattedDateAndTime } from '@letta-web/helpful-client-utils';

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
  const t = useTranslations('ADE/AgentSettingsPanel');
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

function SystemPromptEditor() {
  const t = useTranslations('ADE/AgentSettingsPanel');
  const [isExpanded, setIsExpanded] = useState(false);
  const { value, onChange, error, lastUpdatedAt } = useUpdateMemory({
    type: 'system',
  });

  return (
    <>
      <Dialog
        size="full"
        isOpen={isExpanded}
        onOpenChange={setIsExpanded}
        errorMessage={error ? t('SystemPromptEditor.error') : ''}
        title={t('SystemPromptEditor.dialog.title')}
        hideConfirm
        preventCloseFromOutside
      >
        <VStack fullHeight gap="form">
          <HStack gap="xlarge" align="center" justify="spaceBetween">
            <div>
              <Alert
                title={t('SystemPromptEditor.dialog.info')}
                variant="info"
              />
            </div>
            <Typography noWrap font="mono" color="muted" variant="body2">
              {t('SystemPromptEditor.dialog.characterCount', {
                count: value.length,
              })}
            </Typography>
          </HStack>
          <RawTextArea
            fullWidth
            fullHeight
            autosize={false}
            hideLabel
            label={t('SystemPromptEditor.label')}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            value={value}
          />
          {lastUpdatedAt && (
            <Typography>
              {t('SystemPromptEditor.updatedAt', {
                date: nicelyFormattedDateAndTime(lastUpdatedAt),
              })}
            </Typography>
          )}
        </VStack>
      </Dialog>
      <RawTextArea
        fullWidth
        autosize={false}
        label={t('SystemPromptEditor.label')}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        value={value}
        expandable={{
          expandText: t('SystemPromptEditor.expand'),
          onExpand: () => {
            setIsExpanded(true);
          },
        }}
      />
    </>
  );
}

export function AgentSettingsPanel() {
  const currentAgent = useCurrentAgent();

  const t = useTranslations('ADE/AgentSettingsPanel');

  const { capitalized: baseName } = useAgentBaseTypeName();

  if (!currentAgent.llm_config) {
    return <LoadingEmptyStatusComponent emptyMessage="" isLoading />;
  }

  return (
    <PanelMainContent>
      <VStack gap={false}>
        <HStack fullWidth align="end">
          <RawInput
            fullWidth
            label={t('agentName.label', { baseName })}
            value={currentAgent.name}
            disabled
          />
          <UpdateNameDialog
            trigger={
              <Button
                hideLabel
                preIcon={<CogIcon />}
                color="tertiary"
                label={t('agentName.edit', { baseName })}
              />
            }
          />
        </HStack>
        <HStack fullWidth align="center">
          <Typography font="mono" color="muted" variant="body2">
            {currentAgent.id}
          </Typography>
          <CopyButton
            copyButtonText={t('copyAgentId', { baseName })}
            color="tertiary-transparent"
            size="small"
            textToCopy={currentAgent.id}
            hideLabel
          />
        </HStack>
      </VStack>
      <ModelSelector llmConfig={currentAgent.llm_config} />
      <SystemPromptEditor />
    </PanelMainContent>
  );
}

export const agentSettingsPanel = {
  templateId: 'agent-settings',
  content: AgentSettingsPanel,
  useGetTitle: () => {
    const t = useTranslations('ADE/AgentSettingsPanel');
    const { capitalized: baseName } = useAgentBaseTypeName();

    return t('title', { baseName });
  },
  data: z.undefined(),
} satisfies PanelTemplate<'agent-settings'>;
