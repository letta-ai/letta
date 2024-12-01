import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  brandKeyToLogo,
  Button,
  CogIcon,
  CopyButton,
  Dialog,
  HStack,
  isBrandKey,
  isMultiValue,
  LoadingEmptyStatusComponent,
  PanelMainContent,
  type PanelTemplate,
  RawInput,
  RawSelect,
  RawTextArea,
  Robot2Icon,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../hooks';
import { z } from 'zod';
import type { AgentState } from '@letta-web/letta-agents-api';
import { useModelsServiceListModels } from '@letta-web/letta-agents-api';
import { useTranslations } from 'next-intl';
import { useDebouncedValue } from '@mantine/hooks';
import { UpdateNameDialog } from '../shared/UpdateAgentNameDialog/UpdateAgentNameDialog';
import { useAgentBaseTypeName } from '../hooks/useAgentBaseNameType/useAgentBaseNameType';
import { useDateFormatter } from '@letta-web/helpful-client-utils';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { webOriginSDKApi, webOriginSDKQueryKeys } from '$letta/client';
import { ExtendedLLMSchema } from '$letta/sdk/models/modelsContracts';
import { getBrandFromModelName } from '$letta/utils';
import { useCurrentUser } from '$letta/client/hooks';
import { trackClientSideEvent } from '@letta-web/analytics/client';
import { AnalyticsEvent } from '@letta-web/analytics';

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
  const { isLocal } = useCurrentAgentMetaData();

  const { data: localModelsList } = useModelsServiceListModels(undefined, {
    enabled: isLocal,
  });

  const { data: serverModlesList } =
    webOriginSDKApi.models.listLLMBackends.useQuery({
      queryKey: webOriginSDKQueryKeys.models.listEmbeddingBackendsWithSearch({
        extended: true,
      }),
      queryData: {
        query: {
          extended: true,
        },
      },
      enabled: !isLocal,
    });

  const modelsList = useMemo(() => {
    return isLocal ? localModelsList : serverModlesList?.body;
  }, [isLocal, localModelsList, serverModlesList]);

  const formattedModelsList = useMemo(() => {
    if (!modelsList) {
      return [];
    }

    return modelsList
      .map((value) => {
        const { model } = value;
        let modelName = model;
        let brand = 'llama';
        let isRecommended = false;
        let badge = '';

        if (ExtendedLLMSchema.safeParse(value).success) {
          const out = ExtendedLLMSchema.safeParse(value).data;

          brand = out?.brand || brand;
          isRecommended = out?.isRecommended || isRecommended;
          badge = out?.tag || badge;
          modelName = out?.displayName || modelName;
        }

        if (brand === 'llama') {
          brand = getBrandFromModelName(model) || brand;
        }

        return {
          icon: isBrandKey(brand) ? brandKeyToLogo(brand) : '',
          label: modelName,
          value: model,
          brand,
          isRecommended,
          badge: badge ? <Badge size="small" content={badge} /> : '',
        };
      })
      .sort(function (a, b) {
        if (a.brand < b.brand) {
          return -1;
        }
        if (a.brand > b.brand) {
          return 1;
        }
        return 0;
      });
  }, [modelsList]);

  const [modelState, setModelState] = useState<SelectedModelType>({
    icon: '',
    label: llmConfig.model,
    value: llmConfig.model,
  });

  const [debouncedModelState] = useDebouncedValue(modelState, 500);

  const value = useMemo(() => {
    const selectedModel = formattedModelsList.find(
      (model) => model.value === modelState.value
    );

    return {
      ...modelState,
      icon: selectedModel?.icon || '',
      badge: selectedModel?.badge || '',
    };
  }, [formattedModelsList, modelState]);

  const groupedModelsList = useMemo(() => {
    if (isLocal) {
      return formattedModelsList;
    }

    const list = formattedModelsList.reduce(
      (acc, model) => {
        if (model.isRecommended) {
          acc.recommended.push(model);
        } else {
          acc.others.push(model);
        }

        return acc;
      },
      {
        recommended: [] as SelectedModelType[],
        others: [] as SelectedModelType[],
      }
    );

    return Object.entries(list).map(([key, value]) => {
      return {
        label:
          key === 'recommended'
            ? t('modelInput.recommended')
            : t('modelInput.others'),
        options: value,
      };
    });
  }, [formattedModelsList, isLocal, t]);

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

  const user = useCurrentUser();

  const { base: baseName } = useAgentBaseTypeName();

  return (
    <>
      {error && <Alert title={t('error')} variant="destructive" />}
      <RawSelect
        fullWidth
        infoTooltip={{
          text: t('modelInput.tooltip', { baseName }),
        }}
        onSelect={(value) => {
          if (isMultiValue(value)) {
            return;
          }

          if (value?.value) {
            if (isLocal) {
              trackClientSideEvent(AnalyticsEvent.LOCAL_AGENT_MODEL_CHANGED, {
                userId: user?.id || '',
                model: value.value,
              });
            } else {
              trackClientSideEvent(AnalyticsEvent.CLOUD_AGENT_MODEL_CHANGED, {
                userId: user?.id || '',
                model: value.value,
              });
            }
          }

          setModelState({
            value: value?.value || '',
            label: value?.label || '',
            icon: value?.icon || '',
          });
        }}
        value={value}
        label={t('modelInput.label')}
        options={groupedModelsList}
      />
    </>
  );
}

function SystemPromptEditor() {
  const t = useTranslations('ADE/AgentSettingsPanel');
  const [isExpanded, setIsExpanded] = useState(false);
  const { syncUpdateCurrentAgent, error, lastUpdatedAt } =
    useSyncUpdateCurrentAgent();
  const { system = '' } = useCurrentAgent();

  const handleChange = useCallback(
    (value: string) => {
      syncUpdateCurrentAgent(() => ({
        system: value,
      }));
    },
    [syncUpdateCurrentAgent]
  );

  const { formatDate } = useDateFormatter();

  return (
    <>
      <Dialog
        size="full"
        isOpen={isExpanded}
        onOpenChange={setIsExpanded}
        errorMessage={error ? t('SystemPromptEditor.error') : ''}
        title={t('SystemPromptEditor.dialog.title')}
        hideConfirm
      >
        <VStack collapseHeight flex gap="form">
          <HStack gap="xlarge" align="center" justify="spaceBetween">
            <div>
              <Alert
                title={t('SystemPromptEditor.dialog.info')}
                variant="info"
              />
            </div>
            <Typography noWrap font="mono" color="muted" variant="body2">
              {t('SystemPromptEditor.dialog.characterCount', {
                count: system.length,
              })}
            </Typography>
          </HStack>
          <RawTextArea
            fullWidth
            flex
            fullHeight
            autosize={false}
            hideLabel
            label={t('SystemPromptEditor.label')}
            onChange={(e) => {
              handleChange(e.target.value);
            }}
            value={system}
          />
          {lastUpdatedAt && (
            <Typography>
              {t('SystemPromptEditor.updatedAt', {
                date: formatDate(lastUpdatedAt),
              })}
            </Typography>
          )}
        </VStack>
      </Dialog>
      <VStack fullHeight gap="small">
        <RawTextArea
          fullWidth
          infoTooltip={{
            text: t('SystemPromptEditor.tooltip'),
          }}
          rightOfLabelContent={
            <Typography variant="body2" color="muted">
              {t('SystemPromptEditor.characterCount', {
                count: system.length,
              })}
            </Typography>
          }
          fullHeight
          flex
          autosize={false}
          label={t('SystemPromptEditor.label')}
          onChange={(e) => {
            handleChange(e.target.value);
          }}
          value={system}
          expandable={{
            expandText: t('SystemPromptEditor.expand'),
            onExpand: () => {
              setIsExpanded(true);
            },
          }}
        />
      </VStack>
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
          <Typography
            noWrap
            overflow="ellipsis"
            align="left"
            font="mono"
            color="muted"
            variant="body2"
          >
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
  useGetMobileTitle: () => {
    const t = useTranslations('ADE/AgentSettingsPanel');
    const { capitalized: baseName } = useAgentBaseTypeName();

    return t('mobileTitle', { baseName });
  },
  useGetTitle: () => {
    const t = useTranslations('ADE/AgentSettingsPanel');
    const { capitalized: baseName } = useAgentBaseTypeName();

    return t('title', { baseName });
  },
  icon: <Robot2Icon />,
  data: z.undefined(),
} satisfies PanelTemplate<'agent-settings'>;
