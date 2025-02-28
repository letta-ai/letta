import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  brandKeyToLogo,
  Button,
  CopyButton,
  Dialog,
  EditIcon,
  HStack,
  isBrandKey,
  isMultiValue,
  LoadingEmptyStatusComponent,
  PanelMainContent,
  RawInput,
  RawSelect,
  RawTextArea,
  Typography,
  VStack,
  useForm,
  FormProvider,
  FormField,
  TextArea,
  Spinner,
  GroupIcon,
  RawAsyncSelect,
  ActionCard,
  Avatar,
  CloseIcon,
  ExternalLinkIcon,
  Tooltip,
  LockClosedIcon,
} from '@letta-cloud/component-library';
import {
  useAgentBaseTypeName,
  useCurrentAgent,
  useCurrentAgentMetaData,
  useSyncUpdateCurrentAgent,
} from '../../hooks';
import { z } from 'zod';
import {
  type AgentState,
  IdentitiesService,
  useIdentitiesServiceRetrieveIdentity,
  UseIdentitiesServiceRetrieveIdentityKeyFn,
} from '@letta-cloud/letta-agents-api';
import {
  UseAgentsServiceRetrieveAgentKeyFn,
  useAgentsServiceModifyAgent,
} from '@letta-cloud/letta-agents-api';
import { useModelsServiceListModels } from '@letta-cloud/letta-agents-api';
import { useTranslations } from '@letta-cloud/translations';
import { useDebouncedCallback, useDebouncedValue } from '@mantine/hooks';
import {
  webOriginSDKApi,
  webOriginSDKQueryKeys,
} from '@letta-cloud/letta-agents-api';
import { ExtendedLLMSchema } from '@letta-cloud/letta-agents-api';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { getBrandFromModelName } from '@letta-cloud/generic-utils';
import { UpdateNameDialog } from '../../shared/UpdateAgentNameDialog/UpdateAgentNameDialog';
import {
  useFeatureFlag,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/web-api-client';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/rbac';
import { useADEAppContext } from '../../AppContext/AppContext';
import { useIdentityTypeToTranslationMap } from '../../IdentitiesTable/hooks/useIdentityTypeToTranslationMap';

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

  const { data: serverModelsList } =
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
    return isLocal ? localModelsList : serverModelsList?.body;
  }, [isLocal, localModelsList, serverModelsList]);

  const formattedModelsList = useMemo(() => {
    if (!modelsList) {
      return [];
    }

    return modelsList
      .map((value) => {
        const { model, handle } = value;
        let modelName = handle || model;
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
    label: llmConfig.handle || llmConfig.model,
    value: llmConfig.model,
  });

  const [debouncedModelState] = useDebouncedValue(modelState, 500);

  const value = useMemo(() => {
    const selectedModel = formattedModelsList.find(
      (model) => model.value === modelState.value,
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
      },
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
      const selectedLLMConfig = modelsList.find(
        (model) => model.model === debouncedModelState.value,
      );

      syncUpdateCurrentAgent(() => ({
        llm_config: selectedLLMConfig,
      }));
    }
  }, [
    llmConfig.model,
    debouncedModelState,
    modelsList,
    syncUpdateCurrentAgent,
  ]);

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  const { base: baseName } = useAgentBaseTypeName();

  return (
    <>
      {error && <Alert title={t('error')} variant="destructive" />}
      <RawSelect
        disabled={!canUpdateAgent}
        fullWidth
        infoTooltip={{
          text: t('modelInput.tooltip', { baseName }),
        }}
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

  const { mutate } = useAgentsServiceModifyAgent();
  const queryClient = useQueryClient();

  const debouncedMutation = useDebouncedCallback(mutate, 500);
  const [localValue, setLocalValue] = useState(currentAgent.system || '');

  const handleChange = useCallback(
    (value: string) => {
      setLocalValue(value);

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
            system: value,
          };
        },
      );

      debouncedMutation({
        agentId: currentAgent.id,
        requestBody: {
          system: value,
        },
      });
    },
    [currentAgent.id, debouncedMutation, queryClient],
  );

  useEffect(() => {
    if (currentAgent.system !== localValue) {
      setLocalValue(currentAgent.system || '');
    }
  }, [localValue, currentAgent.system]);

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
      <VStack fullHeight gap="small">
        <RawTextArea
          fullWidth
          key="system"
          variant="secondary"
          disabled={!canUpdateAgent}
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
        color="tertiary"
        size="small"
        textToCopy={identifier}
        hideLabel
      />
    </HStack>
  );
}

function TemplateDescription() {
  const { agentId } = useCurrentAgentMetaData();

  const { description } = useCurrentAgent();
  const [localDescription, setLocalDescription] = useState(description || '');

  const t = useTranslations('ADE/AgentSettingsPanel');

  const { mutate, isPending } = useAgentsServiceModifyAgent();

  const debouncedMutation = useDebouncedCallback((args) => {
    mutate(args);
    void queryClient.invalidateQueries({
      queryKey: webApiQueryKeys.agentTemplates.listAgentTemplates,
      exact: false,
    });
  }, 500);

  const queryClient = useQueryClient();

  const handleUpdate = useCallback(
    async (description: string) => {
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
              description,
            },
          });

          return {
            ...oldData,
            description,
          };
        },
      );
    },
    [debouncedMutation, agentId, queryClient],
  );

  const [canUpdateTemplate] = useADEPermissions(
    ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES,
  );

  return (
    <RawTextArea
      onChange={(e) => {
        setLocalDescription(e.target.value);
        void handleUpdate(e.target.value);
      }}
      disabled={!canUpdateTemplate}
      rightOfLabelContent={isPending ? <Spinner size="xsmall" /> : null}
      placeholder={t('TemplateDescription.placeholder')}
      rows={3}
      value={localDescription || ''}
      fullWidth
      variant="secondary"
      resize="none"
      autosize
      maxRows={3}
      minRows={3}
      label={t('TemplateDescription.label')}
    />
  );
}

interface IdentityElementProps {
  identityId: string;
  onRemove: () => void;
}

function IdentityElement(props: IdentityElementProps) {
  const { identityId, onRemove } = props;

  const t = useTranslations('ADE/AgentSettingsPanel');
  const { data } = useIdentitiesServiceRetrieveIdentity({
    identityId,
  });

  if (!data) {
    return <ActionCard title="Loading" isSkeleton />;
  }

  return (
    <ActionCard
      title={data.name}
      icon={<Avatar name={data.name} />}
      mainAction={
        <HStack align="center">
          {data.identifier_key && (
            <Typography color="muted" variant="body2">
              {data.identifier_key}
            </Typography>
          )}
          <Button
            label={t('IdentityElement.remove')}
            hideLabel
            color="tertiary"
            preIcon={<CloseIcon />}
            onClick={onRemove}
          />
        </HStack>
      }
    ></ActionCard>
  );
}

interface IdentitiesEditorDialogProps {
  defaultIdentityIds: string[];
}

function IdentitiesEditorDialog(props: IdentitiesEditorDialogProps) {
  const t = useTranslations('ADE/AgentSettingsPanel');
  const { projectId } = useADEAppContext();
  const identityTypeToTranslationMap = useIdentityTypeToTranslationMap();
  const { id: agentId } = useCurrentAgent();
  const { mutate, isPending, isError } = useAgentsServiceModifyAgent();
  const [isOpened, setIsOpened] = useState(false);

  const { defaultIdentityIds } = props;

  const queryClient = useQueryClient();
  const [identityIds, setIdentityIds] = useState<string[]>(defaultIdentityIds);

  const handleMutate = useCallback(() => {
    mutate(
      {
        agentId,
        requestBody: {
          identity_ids: identityIds,
        },
      },
      {
        onSuccess: () => {
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

              return {
                ...oldData,
                identity_ids: identityIds,
              };
            },
          );

          setIsOpened(false);
        },
      },
    );
  }, [identityIds, mutate, queryClient, agentId]);

  const searchIdentities = useCallback(
    async (query: string) => {
      const response = await IdentitiesService.listIdentities({
        name: query,
        ...(projectId ? { projectId } : {}),
      });

      return response.map((identity) => {
        queryClient.setQueriesData(
          {
            queryKey: UseIdentitiesServiceRetrieveIdentityKeyFn({
              identityId: identity.id || '',
            }),
          },
          identity,
        );

        return {
          label: `${identity.name}${identity.identifier_key ? ` (${identity.identifier_key})` : ''}`,
          icon: <Avatar name={identity.name} />,
          badge: (
            <Badge
              content={identityTypeToTranslationMap[identity.identity_type]}
            />
          ),
          value: identity.id,
        };
      });
    },
    [projectId, queryClient, identityTypeToTranslationMap],
  );

  const handleRemove = useCallback(
    (identityId: string) => {
      setIdentityIds((existing) => {
        const set = new Set(existing);

        set.delete(identityId);
        return Array.from(set);
      });
    },
    [setIdentityIds],
  );

  const identitiesUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.location.href.split('/agents')[0];
  }, []);

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setIdentityIds(defaultIdentityIds);
        }

        setIsOpened(isOpen);
      }}
      isOpen={isOpened}
      errorMessage={isError ? t('IdentitiesEditorDialog.error') : ''}
      size="large"
      onConfirm={handleMutate}
      isConfirmBusy={isPending}
      color="background"
      trigger={
        <Button
          hideLabel
          preIcon={<GroupIcon />}
          color="secondary"
          label={t('IdentitiesEditorDialog.trigger')}
        />
      }
      confirmText={t('IdentitiesEditorDialog.save')}
      title={t('IdentitiesEditorDialog.title')}
    >
      <VStack gap="large">
        <RawAsyncSelect
          labelVariant="simple"
          fullWidth
          value={[]}
          hideLabel
          styleConfig={{
            size: 'large',
          }}
          postIcon={<GroupIcon />}
          label={t('IdentitiesEditorDialog.identitySelector.label')}
          placeholder={t('IdentitiesEditorDialog.identitySelector.placeholder')}
          noOptionsMessage={() =>
            t('IdentitiesEditorDialog.identitySelector.noIdentities')
          }
          loadOptions={searchIdentities}
          onSelect={(value) => {
            if (isMultiValue(value) || !value?.value) {
              return;
            }

            setIdentityIds((existing) => {
              const set = new Set<string>(existing);

              if (typeof value.value === 'string') {
                set.add(value.value);
              }

              return Array.from(set);
            });
          }}
        />
        <VStack borderTop paddingTop="small">
          <HStack justify="spaceBetween" align="center" fullWidth>
            <Typography bold>
              {t('IdentitiesEditorDialog.currentIdentities')}
            </Typography>
            {identitiesUrl && (
              <Button
                target="_blank"
                label={t('IdentitiesEditorDialog.manageIdentities')}
                href={`${identitiesUrl}/identities`}
                color="tertiary"
                postIcon={<ExternalLinkIcon />}
                size="small"
              />
            )}
          </HStack>
          <VStack fullWidth gap="small">
            {identityIds.length === 0 && (
              <Alert
                variant="info"
                title={t('IdentitiesEditorDialog.noIdentities')}
              ></Alert>
            )}
            {identityIds.map((identityId) => (
              <IdentityElement
                onRemove={() => {
                  handleRemove(identityId);
                }}
                key={identityId}
                identityId={identityId}
              />
            ))}
          </VStack>
        </VStack>
      </VStack>
    </Dialog>
  );
}

function IdentityViewer() {
  const currentAgent = useCurrentAgent();

  const { data: initialIdentity } = useIdentitiesServiceRetrieveIdentity(
    {
      identityId: currentAgent?.identity_ids?.[0] || '',
    },
    undefined,
    {
      enabled: !!currentAgent?.identity_ids?.[0],
    },
  );

  const { isFromTemplate } = useCurrentAgentMetaData();

  const { id: agentId } = useCurrentAgent();
  const { projectId } = useADEAppContext();

  const t = useTranslations('ADE/AgentSettingsPanel');

  const { data: sharedAgentInfo } =
    webApi.sharedAgentChats.getSharedChatConfiguration.useQuery({
      queryKey: webApiQueryKeys.sharedAgentChats.getSharedChatConfiguration({
        agentId,
        projectId,
      }),
      queryData: {
        params: {
          agentId,
          projectId,
        },
      },
      enabled: isFromTemplate,
    });

  const isFromLaunchLink = useMemo(() => {
    return sharedAgentInfo?.body.isFromLaunchLink;
  }, [sharedAgentInfo]);

  const identityValue = useMemo(() => {
    if (!currentAgent) {
      return '';
    }

    if (
      !currentAgent?.identity_ids ||
      currentAgent?.identity_ids.length === 0
    ) {
      return t('IdentityViewer.status.noIdentities');
    }

    if (isFromTemplate && !sharedAgentInfo) {
      return t('IdentityViewer.status.loading');
    }

    if (!initialIdentity) {
      return t('IdentityViewer.status.loading');
    }

    if (currentAgent.identity_ids.length === 1) {
      return initialIdentity.name;
    }

    return t('IdentityViewer.status.multipleIdentities', {
      name: initialIdentity.name,
      count: currentAgent.identity_ids.length - 1,
    });
  }, [initialIdentity, currentAgent, t, sharedAgentInfo, isFromTemplate]);

  const identityLabel = useMemo(() => {
    if (currentAgent?.identity_ids?.length === 1) {
      return t('IdentityViewer.label.singular');
    }

    return t('IdentityViewer.label.multiple');
  }, [currentAgent?.identity_ids?.length, t]);

  return (
    <HStack fullWidth align="end">
      <RawInput
        infoTooltip={{
          text: t('IdentityViewer.tooltip'),
        }}
        label={identityLabel}
        value={identityValue}
        disabled
        fullWidth
      />
      {isFromLaunchLink ? (
        <Tooltip asChild content={t('IdentityViewer.launchLink')}>
          <Button
            label={t('IdentityViewer.launchLink')}
            hideLabel
            color="secondary"
            disabled
            _use_rarely_disableTooltip
            preIcon={<LockClosedIcon />}
          />
        </Tooltip>
      ) : (
        !!currentAgent && (
          <IdentitiesEditorDialog
            defaultIdentityIds={currentAgent.identity_ids || []}
          />
        )
      )}
    </HStack>
  );
}

export function AgentSettingsPanel() {
  const currentAgent = useCurrentAgent();
  const { isTemplate } = useCurrentAgentMetaData();

  const t = useTranslations('ADE/AgentSettingsPanel');

  const { capitalized: baseName } = useAgentBaseTypeName();

  const { isLoading: isLoadingFlag, data: isFlagEnabled } =
    useFeatureFlag('IDENTITIES');

  const isIdentitiesEnabled = isFlagEnabled && !isLoadingFlag;

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
                preIcon={<EditIcon />}
                color="secondary"
                label={t('agentName.edit', { baseName })}
              />
            }
          />
        </HStack>
        <AgentIdentifierToCopy />
      </VStack>
      {isTemplate && <TemplateDescription />}
      <ModelSelector llmConfig={currentAgent.llm_config} />
      {isIdentitiesEnabled && !isTemplate && <IdentityViewer />}
      <SystemPromptEditor />
    </PanelMainContent>
  );
}
