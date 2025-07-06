import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  Dialog,
  EditIcon,
  HStack,
  isMultiValue,
  LoadingEmptyStatusComponent,
  PanelMainContent,
  RawInput,
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
import { useDebouncedCallback } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { UpdateNameDialog } from '../../shared/UpdateAgentNameDialog/UpdateAgentNameDialog';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useADEAppContext } from '../../AppContext/AppContext';
import { useIdentityTypeToTranslationMap } from '../../IdentitiesTable/hooks/useIdentityTypeToTranslationMap';
import { useADETour } from '../../hooks/useADETour/useADETour';
import { ModelSelector } from './ModelSelector/ModelSelector';
import { SystemPromptEditor } from '../AdvancedSettingsPanel/components/SystemPromptEditor/SystemPromptEditor';

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
        variant="body4"
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
      testId="update-identities-dialog"
      isConfirmBusy={isPending}
      color="background"
      trigger={
        <Button
          size="small"
          data-testid="update-identities"
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
          fullWidth
          value={[]}
          hideLabel
          styleConfig={{
            size: 'large',
          }}
          postIcon={<GroupIcon />}
          data-testid="identities-selector"
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

  const { data: sharedAgentInfo, isLoading: isLoadingSharedAgentInfo } =
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
      retry: false,
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

    if (isFromTemplate && isLoadingSharedAgentInfo) {
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
  }, [
    initialIdentity,
    isLoadingSharedAgentInfo,
    currentAgent,
    t,
    isFromTemplate,
  ]);

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
        data-testid="identity-viewer-input"
        fullWidth
        size="small"
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
      size="small"
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
            size="small"
          />
          <UpdateNameDialog
            trigger={
              <Button
                size="small"
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
      <SystemPromptEditor />
      <ModelSelector llmConfig={currentAgent.llm_config} />
      {!isTemplate && <IdentityViewer />}
      {isTemplate && <TemplateDescription />}
      {!isTemplate && <AgentTags />}
    </PanelMainContent>
  );
}
