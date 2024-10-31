import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../hooks';
import {
  LoadingEmptyStatusComponent,
  PanelMainContent,
  RawInput,
  RawSlider,
  VStack,
} from '@letta-web/component-library';
import React, { useCallback, useMemo } from 'react';
import { useModelsServiceListModels } from '@letta-web/letta-agents-api';

function ModelParametersPanel() {
  const currentAgent = useCurrentAgent();
  const { data: modelsList } = useModelsServiceListModels();
  const t = useTranslations('ADE/ModelParameters');

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

  if (!currentAgent.llm_config || !modelsList) {
    return <LoadingEmptyStatusComponent emptyMessage="" isLoading />;
  }

  return (
    <PanelMainContent>
      <VStack fullWidth gap="form" justify="start">
        <RawInput
          fullWidth
          label={t('model')}
          value={currentAgent.llm_config.model || ''}
          disabled
        />
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
        <RawInput
          fullWidth
          label={t('modelEndpoint')}
          value={currentAgent.llm_config.model_endpoint || ''}
          disabled
        />
        <RawInput
          fullWidth
          label={t('endpointType')}
          value={currentAgent.llm_config.model_endpoint_type || ''}
          disabled
        />
      </VStack>
    </PanelMainContent>
  );
}

export const modelParametersPanel = {
  templateId: 'model-parameters',
  content: ModelParametersPanel,
  useGetTitle: () => {
    const t = useTranslations('ADE/ModelParameters');

    return t('title');
  },
  data: z.undefined(),
};
