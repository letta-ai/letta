import { useTranslations } from '@letta-cloud/translations';
import { useADEAppContext } from '../../../AppContext/AppContext';
import { useIdentityTypeToTranslationMap } from '../../../IdentitiesTable/hooks/useIdentityTypeToTranslationMap';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../../hooks';
import {
  type AgentState,
  IdentitiesService,
  type Identity,
  useAgentsServiceModifyAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
  useIdentitiesServiceListIdentities,
  useIdentitiesServiceRetrieveIdentity,
} from '@letta-cloud/sdk-core';
import React, { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActionCard,
  Alert,
  Avatar,
  Badge,
  Button,
  CloseIcon,
  Dialog,
  ExternalLinkIcon,
  GroupIcon,
  HStack,
  isMultiValue,
  LockClosedIcon,
  RawAsyncSelect,
  RawInput,
  Tooltip,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

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

  const mapIdentityToOption = useCallback(
    (identity: Identity) => {
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
    },
    [identityTypeToTranslationMap],
  );

  const { data: defaultIdentities } = useIdentitiesServiceListIdentities({
    limit: 10,
  });

  const mappedDefaultIdentities = useMemo(() => {
    if (!defaultIdentities) {
      return [];
    }

    return defaultIdentities.map(mapIdentityToOption);
  }, [defaultIdentities, mapIdentityToOption]);

  const searchIdentities = useCallback(
    async (query: string) => {
      const response = await IdentitiesService.listIdentities({
        name: query,
        ...(projectId ? { projectId } : {}),
      });

      return response.map(mapIdentityToOption);
    },
    [projectId, mapIdentityToOption],
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
          defaultOptions={mappedDefaultIdentities}
          isLoading={!defaultIdentities}
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

export function IdentityViewer() {
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
