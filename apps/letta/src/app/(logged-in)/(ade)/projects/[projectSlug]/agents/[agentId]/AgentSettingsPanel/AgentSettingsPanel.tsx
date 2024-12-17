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
  LettaInvaderOutlineIcon,
  Typography,
  VStack,
  useForm,
  FormProvider,
  FormField,
  TextArea,
} from '@letta-web/component-library';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../hooks';
import { z } from 'zod';
import type { AgentState } from '@letta-web/letta-agents-api';
import {
  UseAgentsServiceGetAgentKeyFn,
  useAgentsServiceUpdateAgent,
} from '@letta-web/letta-agents-api';
import { useModelsServiceListModels } from '@letta-web/letta-agents-api';
import { useTranslations } from 'next-intl';
import { useDebouncedCallback, useDebouncedValue } from '@mantine/hooks';
import { UpdateNameDialog } from '../shared/UpdateAgentNameDialog/UpdateAgentNameDialog';
import { useAgentBaseTypeName } from '../hooks/useAgentBaseNameType/useAgentBaseNameType';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { webOriginSDKApi, webOriginSDKQueryKeys } from '$letta/client';
import { ExtendedLLMSchema } from '$letta/sdk/models/modelsContracts';
import { getBrandFromModelName } from '$letta/utils';
import { useCurrentUser } from '$letta/client/hooks';
import { trackClientSideEvent } from '@letta-web/analytics/client';
import { AnalyticsEvent } from '@letta-web/analytics';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';

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
  const { mutate, isPending, isError } = useAgentsServiceUpdateAgent();
  const queryClient = useQueryClient();
  const currentAgent = useCurrentAgent();
  const t = useTranslations('ADE/AgentSettingsPanel');
  const form = useForm<SystemPromptEditorFormType>({
    resolver: zodResolver(systemPromptEditorForm),
    defaultValues: {
      system,
    },
  });

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
                queryKey: UseAgentsServiceGetAgentKeyFn({
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
              }
            );
            setIsExpanded(false);
          },
        }
      );
    },
    [currentAgent.id, mutate, queryClient, setIsExpanded]
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

  const { mutate } = useAgentsServiceUpdateAgent();
  const queryClient = useQueryClient();

  const debouncedMutation = useDebouncedCallback(mutate, 500);
  const [localValue, setLocalValue] = useState(currentAgent.system || '');

  const handleChange = useCallback(
    (value: string) => {
      setLocalValue(value);

      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceGetAgentKeyFn({
            agentId: currentAgent.id,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            system: value,
          };
        }
      );

      debouncedMutation({
        agentId: currentAgent.id,
        requestBody: {
          system: value,
        },
      });
    },
    [currentAgent.id, debouncedMutation, queryClient]
  );

  useEffect(() => {
    if (currentAgent.system !== localValue) {
      setLocalValue(currentAgent.system || '');
    }
  }, [localValue, currentAgent.system]);

  return (
    <>
      {isExpanded && (
        <SystemPromptEditorDialog
          system={currentAgent.system || ''}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
        />
      )}
      <VStack fullHeight gap="small">
        <RawTextArea
          fullWidth
          key="system"
          infoTooltip={{
            text: t('SystemPromptEditor.tooltip'),
          }}
          rightOfLabelContent={
            <Typography variant="body2" color="muted">
              {t('SystemPromptEditor.characterCount', {
                count: (currentAgent?.system || '').length,
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
          value={localValue}
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

function AgentIdentifierToCopy() {
  const currentAgent = useCurrentAgent();
  const { isTemplate } = useCurrentAgentMetaData();

  const t = useTranslations('ADE/AgentSettingsPanel');

  const { capitalized: baseName } = useAgentBaseTypeName();

  const identifier = useMemo(() => {
    if (!isTemplate) {
      return currentAgent.id;
    }

    return `${currentAgent.name}:latest`;
  }, [currentAgent.id, currentAgent.name, isTemplate]);

  return (
    <HStack fullWidth align="center">
      <Typography
        noWrap
        overflow="ellipsis"
        align="left"
        font="mono"
        color="muted"
        variant="body2"
      >
        {identifier}
      </Typography>
      <CopyButton
        copyButtonText={t('AgentIdentifierToCopy.copyAgentId', { baseName })}
        color="tertiary-transparent"
        size="small"
        textToCopy={identifier}
        hideLabel
      />
    </HStack>
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
                data-testid="update-agent-name-button"
                preIcon={<CogIcon />}
                color="tertiary"
                label={t('agentName.edit', { baseName })}
              />
            }
          />
        </HStack>
        <AgentIdentifierToCopy />
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
  icon: <LettaInvaderOutlineIcon />,
  data: z.undefined(),
} satisfies PanelTemplate<'agent-settings'>;
