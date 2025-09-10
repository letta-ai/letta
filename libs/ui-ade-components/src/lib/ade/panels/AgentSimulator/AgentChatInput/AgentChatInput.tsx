import {
  OpenInNetworkInspectorButton,
  useCurrentAgentMetaData,
  useQuickADETour,
} from '@letta-cloud/ui-ade-components';
import {
  Avatar,
  ChatInput,
  type ChatInputRef,
  Link,
  PersonIcon,
  type RoleOption,
  SystemIcon,
} from '@letta-cloud/ui-component-library';
import {
  AgentsService,
  IdentitiesService,
  type Identity,
  type LettaUserMessageContentUnion,
} from '@letta-cloud/sdk-core';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useCurrentAgent, useCurrentAgentActiveRuns } from '../../../../hooks';
import { jsonToCurl } from '@letta-cloud/utils-shared';
import { useCurrentAPIHostConfig } from '@letta-cloud/utils-client';
import { useCurrentSimulatedAgent } from '../../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { useFeatureFlag, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useSendMessage } from '../../../../hooks/useSendMessage/useSendMessage';
import { useTranslations } from '@letta-cloud/translations';
import { useAgentMessages } from '../../../../hooks/useAgentMessages/useAgentMessages';
import { HTILConfirmationInput } from './HTILConfirmationInput/HTILConfirmationInput';

function useSimulatorIdentities(): Identity[] {
  const { identity_ids } = useCurrentAgent();
  const [identities, setIdentities] = useState<Identity[]>([]);

  useEffect(() => {
    if (identity_ids && identity_ids.length > 0) {
      const promises = identity_ids.map((identityId) =>
        IdentitiesService.retrieveIdentity({ identityId }),
      );
      Promise.all(promises)
        .then((results) => {
          setIdentities(results);
        })
        .catch((error) => {
          console.error('Error fetching identities:', error);
        });
    }
  }, [identity_ids]);

  return identities;
}

function useBillingTier() {
  const { isLocal } = useCurrentAgentMetaData();

  const { data } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
      enabled: !isLocal,
    });

  return useMemo(() => {
    return data?.body.billingTier || 'enterprise';
  }, [data?.body.billingTier]);
}

export function AgentChatInput() {
  const billingTier = useBillingTier();

  const { isLocal } = useCurrentAgentMetaData();
  const { id: agentIdToUse } = useCurrentSimulatedAgent();
  const { data: isPollActiveRunsEnabled } = useFeatureFlag(
    'POLL_ACTIVE_RUNS_IN_SIMULATOR',
  );

  const t = useTranslations('ADE/AgentSimulator');

  const { data: isBackgroundModeEnabled } = useFeatureFlag('BACKGROUND_MODE');

  const { hasActiveRuns, setOptimisticActiveRun, clearOptimisticActiveRuns } =
    useCurrentAgentActiveRuns();

  const ref = useRef<ChatInputRef | null>(null);
  const hasRunOnce = useRef(false);

  const {
    sendMessage,
    resumeMessage,
    stopMessage,
    isError: hasFailedToSendMessage,
    isPending,
    errorCode,
  } = useSendMessage({
    onFailedToSendMessage: (message) => {
      ref.current?.setChatMessage(message);
      if (isPollActiveRunsEnabled) {
        clearOptimisticActiveRuns();
      }
    },
    onStreamCompletion: isPollActiveRunsEnabled
      ? clearOptimisticActiveRuns
      : undefined,
  });

  useEffect(() => {
    // Run on page mount
    if (isBackgroundModeEnabled && agentIdToUse && !hasRunOnce.current) {
      hasRunOnce.current = true;
      void resumeMessage({
        agentId: agentIdToUse || '',
        overrideSeqId: 0,
      });
    }
  }, [agentIdToUse, resumeMessage, isBackgroundModeEnabled]);

  const hasFailedToSendMessageText = useMemo(() => {
    if (!hasFailedToSendMessage) {
      return;
    }

    switch (errorCode) {
      case 'CONTEXT_WINDOW_EXCEEDED':
        return t('hasFailedToSendMessageText.contextWindowExceeded');
      case 'RATE_LIMIT_EXCEEDED':
        return t('hasFailedToSendMessageText.rateLimitExceeded');
      case 'AGENT_LIMIT_EXCEEDED':
        switch (billingTier) {
          case 'enterprise':
            return t(
              'hasFailedToSendMessageText.agentLimitExceeded.enterprise',
            );
          case 'pro':
            return t.rich('hasFailedToSendMessageText.agentLimitExceeded.pro', {
              link: (chunks) => {
                return (
                  <Link target="_blank" href="/settings/organization/billing">
                    {chunks}
                  </Link>
                );
              },
            });
          case 'scale':
            return t('hasFailedToSendMessageText.agentLimitExceeded.scale');
          default:
            return t.rich(
              'hasFailedToSendMessageText.agentLimitExceeded.free',
              {
                link: (chunks) => {
                  return (
                    <Link target="_blank" href="/settings/organization/billing">
                      {chunks}
                    </Link>
                  );
                },
              },
            );
        }
      case 'FREE_USAGE_EXCEEDED':
        if (billingTier === 'enterprise') {
          return t('hasFailedToSendMessageText.freeUsageExceeded.enterprise');
        }
        if (billingTier === 'pro') {
          return t.rich('hasFailedToSendMessageText.freeUsageExceeded.pro', {
            link: (chunks) => {
              return (
                <Link target="_blank" href="/settings/organization/billing">
                  {chunks}
                </Link>
              );
            },
          });
        }

        if (billingTier === 'scale') {
          return t('hasFailedToSendMessageText.freeUsageExceeded.scale');
        }

        return t.rich('hasFailedToSendMessageText.freeUsageExceeded.free', {
          link: (chunks) => {
            return (
              <Link target="_blank" href="/settings/organization/billing">
                {chunks}
              </Link>
            );
          },
        });
      case 'PREMIUM_USAGE_EXCEEDED':
        if (billingTier === 'enterprise') {
          return t(
            'hasFailedToSendMessageText.premiumUsageExceeded.enterprise',
          );
        }

        if (billingTier === 'scale') {
          return t('hasFailedToSendMessageText.premiumUsageExceeded.scale');
        }

        if (billingTier === 'pro') {
          return t.rich('hasFailedToSendMessageText.premiumUsageExceeded.pro', {
            link: (chunks) => {
              return (
                <Link target="_blank" href="/settings/organization/billing">
                  {chunks}
                </Link>
              );
            },
          });
        }

        return t.rich('hasFailedToSendMessageText.premiumUsageExceeded.free', {
          link: (chunks) => {
            return (
              <Link target="_blank" href="/settings/organization/billing">
                {chunks}
              </Link>
            );
          },
        });
      case 'CREDIT_LIMIT_EXCEEDED':
        return t.rich('hasFailedToSendMessageText.creditLimitExceeded', {
          link: (chunks) => {
            return (
              <Link target="_blank" href="/settings/organization/billing">
                {chunks}
              </Link>
            );
          },
        });
      case 'INTERNAL_SERVER_ERROR':
      default:
        if (isLocal) {
          return t('hasFailedToSendMessageText.local');
        }
        return t('hasFailedToSendMessageText.cloud');
    }
  }, [hasFailedToSendMessage, billingTier, isLocal, t, errorCode]);

  const { isTemplate } = useCurrentAgentMetaData();
  const hostConfig = useCurrentAPIHostConfig({
    isLocal,
    attachApiKey: false,
  });

  const getSendSnippet = useCallback(
    (role: RoleOption, content: LettaUserMessageContentUnion[] | string) => {
      if (isTemplate) {
        return undefined;
      }

      return jsonToCurl({
        url: `${hostConfig.url}/v1/agents/${agentIdToUse}/messages/stream`,
        headers: {
          ...hostConfig.headers,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: {
          messages: [
            {
              role: role.value !== 'system' ? 'user' : 'system',
              content,
            },
          ],
          stream_steps: true,
          stream_tokens: true,
        },
        method: 'POST',
      });
    },
    [agentIdToUse, hostConfig.headers, hostConfig.url, isTemplate],
  );
  const identities = useSimulatorIdentities();

  const { currentStep, setStep } = useQuickADETour();
  const agentState = useCurrentAgent();

  const handleOnboardingStepChange = useCallback(
    function handleOnboardingStepChange() {
      if (currentStep === 'message') {
        trackClientSideEvent(AnalyticsEvent.USER_ONBOARDING_STEP_COMPLETED, {
          onboarding_type: 'create:new_agent',
          onboarding_step: 'message_agent',
        });

        setStep('simulator');

        if (
          'tool_rules' in agentState &&
          Array.isArray(agentState.tool_rules) &&
          agentState.tool_rules.length > 0
        ) {
          AgentsService.modifyAgent({
            agentId: agentIdToUse || '',
            requestBody: {
              // remove the memory_rethink tool rule
              tool_rules: agentState.tool_rules.filter(
                (rule) => rule.tool_name !== 'memory_rethink',
              ),
            },
          });
        }
      }
    },
    [agentIdToUse, agentState, currentStep, setStep],
  );

  const { data: messages } = useAgentMessages({
    agentId: agentIdToUse,
    isEnabled: true,
    refetchInterval: false,
  });

  const mostRecentMessage = useMemo(() => {
    // pages
    if (!messages) {
      return null;
    }

    if (messages.pages.length === 0) {
      return null;
    }
    return messages.pages[0][messages.pages[0].length - 1];
  }, [messages]);

  if (

    mostRecentMessage?.message_type === 'approval_request_message' &&
    !isPending
  ) {
    return (
      <HTILConfirmationInput
        mostRecentMessageId={mostRecentMessage.id}
        onApprove={() => {
          sendMessage({
            message: {
              type: 'approval',
              approve: true,
              approval_request_id: mostRecentMessage.id,
            },
            agentId: agentIdToUse || '',
          });
        }}
        onDeny={() => {
          sendMessage({
            message: {
              type: 'approval',
              approve: false,
              approval_request_id: mostRecentMessage.id,
              reason: 'Cancelled by user',
            },
            agentId: agentIdToUse || '',
          });
        }}
        message={mostRecentMessage}
      />
    );
  }

  return (
    <ChatInput
      shine={currentStep === 'message'}
      errorActionButton={<OpenInNetworkInspectorButton />}
      disabled={!agentIdToUse}
      roles={[
        ...(identities.length > 0
          ? identities.map((identity) => ({
              value: identity?.identity_type || '',
              identityId: identity?.id || '',
              label: identity?.name || '',
              icon: <Avatar name={identity?.name || ''} size="xsmall" />,
            }))
          : []),
        {
          value: 'user',
          identityId: 'placeholderId',
          label: t('role.user'),
          icon: <PersonIcon />,
        },
        {
          value: 'system',
          label: t('role.system'),
          icon: <SystemIcon />,
        },
      ]}
      ref={ref}
      getSendSnippet={getSendSnippet}
      hasFailedToSendMessageText={hasFailedToSendMessageText}
      sendingMessageText={t('sendingMessage')}
      modelHandle={agentState.llm_config?.handle ?? undefined}
      onSendMessage={(
        role: RoleOption,
        content: LettaUserMessageContentUnion[] | string,
      ) => {
        if (isPollActiveRunsEnabled) {
          setOptimisticActiveRun();
        }
        sendMessage({
          message: {
            type: 'default',
            role,
            content,
          },
          agentId: agentIdToUse || '',
        });

        handleOnboardingStepChange();
      }}
      onStopMessage={() => stopMessage(agentIdToUse || '')}
      isSendingMessage={
        isPending || (!!isPollActiveRunsEnabled && hasActiveRuns)
      }
    />
  );
}
