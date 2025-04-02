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
  Spinner,
  GroupIcon,
  RawAsyncSelect,
  ActionCard,
  Avatar,
  CloseIcon,
  ExternalLinkIcon,
  Tooltip,
  LockClosedIcon,
  RawCreatableAsyncSelect,
  OnboardingAsideFocus,
} from '@letta-cloud/ui-component-library';
import {
  useAgentBaseTypeName,
  useCurrentAgent,
  useCurrentAgentMetaData,
  useSyncUpdateCurrentAgent,
} from '../../hooks';
import {
  type AgentState,
  IdentitiesService,
  useIdentitiesServiceRetrieveIdentity,
  UseIdentitiesServiceRetrieveIdentityKeyFn,
} from '@letta-cloud/sdk-core';
import {
  UseAgentsServiceRetrieveAgentKeyFn,
  useAgentsServiceModifyAgent,
} from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { useDebouncedCallback, useDebouncedValue } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { UpdateNameDialog } from '../../shared/UpdateAgentNameDialog/UpdateAgentNameDialog';
import {
  ExtendedLLMSchema,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useADEAppContext } from '../../AppContext/AppContext';
import { useIdentityTypeToTranslationMap } from '../../IdentitiesTable/hooks/useIdentityTypeToTranslationMap';
import { getBrandFromModelName } from '@letta-cloud/utils-shared';
import { useInferenceModels } from '../../hooks/useInferenceModels/useInferenceModels';
import { useADETour } from '../../hooks/useADETour/useADETour';

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

  const modelsList = useInferenceModels();

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

  const { isLocal } = useCurrentAgentMetaData();

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
      rows={2}
      value={localDescription || ''}
      fullWidth
      variant="secondary"
      resize="none"
      autosize
      maxRows={2}
      minRows={2}
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
      infoTooltip={{
        text: t('tags.tooltip'),
      }}
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

interface AgentSettingsOnboardingProps {
  children: React.ReactNode;
}

export function AgentSettingsOnboarding(props: AgentSettingsOnboardingProps) {
  const t = useTranslations('ADE/AgentSettingsPanel');
  const { children } = props;

  const { currentStep, setStep } = useADETour();

  if (currentStep !== 'template') {
    return <>{children}</>;
  }

  return (
    <OnboardingAsideFocus
      className="w-full h-full"
      title={t('AgentSettingsOnboarding.title')}
      placement="right-start"
      description={t('AgentSettingsOnboarding.description')}
      isOpen
      totalSteps={4}
      nextStep={
        <Button
          fullWidth
          size="large"
          bold
          onClick={() => {
            setStep('core_memories');
          }}
          label={t('AgentSettingsOnboarding.next')}
        />
      }
      currentStep={1}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

export function AgentSettingsPanel() {
  const currentAgent = useCurrentAgent();
  const { isTemplate } = useCurrentAgentMetaData();

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
            label={t('agentName.label')}
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
      {!isTemplate && <IdentityViewer />}
      {isTemplate && <TemplateDescription />}
      {!isTemplate && <AgentTags />}
      <ModelSelector llmConfig={currentAgent.llm_config} />
    </PanelMainContent>
  );
}
