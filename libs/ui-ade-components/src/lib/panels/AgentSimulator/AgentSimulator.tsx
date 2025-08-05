'use client';
import {
  Button,
  ChatInput,
  PersonIcon,
  SystemIcon,
  Typography,
  WarningIcon,
  Link,
  OnboardingAsideFocus,
  Avatar,
} from '@letta-cloud/ui-component-library';
import type {
  ChatInputRef,
  RoleOption,
} from '@letta-cloud/ui-component-library';
import { VStack } from '@letta-cloud/ui-component-library';
import { useEffect } from 'react';
import { useMemo } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import type {
  Identity,
  LettaUserMessageContentUnion,
  LettaMessageUnion,
  ListMessagesResponse,
  SystemMessage,
  UserMessage,
} from '@letta-cloud/sdk-core';
import { v4 as uuidv4 } from 'uuid';
import { IdentitiesService } from '@letta-cloud/sdk-core';
import { ErrorMessageSchema } from '@letta-cloud/sdk-core';
import {
  AgentMessageSchema,
  UseAgentsServiceListMessagesKeyFn,
} from '@letta-cloud/sdk-core';
import { OpenInNetworkInspectorButton, useCurrentAgent } from '../../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { get } from 'lodash-es';
import type { z } from 'zod';
import { useTranslations } from '@letta-cloud/translations';
import { useLocalStorage } from '@mantine/hooks';
import {
  useSetOnboardingStep,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import { useCurrentSimulatedAgent } from '../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { useCurrentAgentMetaData } from '../../hooks';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { jsonToCurl } from '@letta-cloud/utils-shared';
import { Messages } from '../Messages/Messages';
import type { MessagesDisplayMode } from '../Messages/Messages';
import {
  useCurrentAPIHostConfig,
  useLettaAgentsAPI,
} from '@letta-cloud/utils-client';
import { isSendingMessageAtom } from './atoms';
import { useADETour } from '../../hooks/useADETour/useADETour';
import type { InfiniteData } from '@tanstack/query-core';
import { ErrorBoundary } from 'react-error-boundary';
import { useNetworkRequest } from '../../hooks/useNetworkRequest/useNetworkRequest';
import { useQuickADETour } from '../../hooks/useQuickADETour/useQuickADETour';
import { ChatroomContext } from './ChatroomContext/ChatroomContext';
import { AgentSimulatorHeader } from './AgentSimulatorHeader/AgentSimulatorHeader';
import { useAtom } from 'jotai';

type ErrorCode = z.infer<typeof ErrorMessageSchema>['code'];

interface SendMessagePayload {
  role: RoleOption;
  agentId: string;
  content: LettaUserMessageContentUnion[] | string;
}

const FAILED_ID = 'failed';
export type SendMessageType = (payload: SendMessagePayload) => void;

interface UseSendMessageOptions {
  onFailedToSendMessage?: (existingMessage: string) => void;
}

function extractMessageTextFromContent(
  content: LettaUserMessageContentUnion[] | string,
): string {
  if (typeof content === 'string') {
    return content;
  } else if (Array.isArray(content) && content.length > 0) {
    const textPart = content.find((part) => part && part.type === 'text');
    if (textPart && textPart.type === 'text') {
      return textPart.text;
    }
  }
  return '';
}

export function useSendMessage(options: UseSendMessageOptions = {}) {
  const [isPending, setIsPending] = useAtom(isSendingMessageAtom);
  const abortController = useRef<AbortController>(undefined);
  const queryClient = useQueryClient();
  const { isLocal } = useCurrentAgentMetaData();
  const [failedToSendMessage, setFailedToSendMessage] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>(undefined);
  const { addNetworkRequest, updateNetworkRequest } = useNetworkRequest();

  const { baseUrl, password } = useLettaAgentsAPI();

  // Temporarily removing to diagnose SAD research agent
  // useEffect(() => {
  //   return () => {
  //     if (abortController.current) {
  //       abortController.current.abort();
  //     }
  //   };
  // }, []);

  const sendMessage: SendMessageType = useCallback(
    async (payload: SendMessagePayload) => {
      const { content, role, agentId } = payload;
      const message = extractMessageTextFromContent(content);
      setIsPending(true);
      setFailedToSendMessage(false);
      setErrorCode(undefined);

      const userMessageOtid = uuidv4();

      function handleError(message: string, errorCode: ErrorCode) {
        setIsPending(false);
        setFailedToSendMessage(true);
        setErrorCode(errorCode);
        options?.onFailedToSendMessage?.(message);

        queryClient.setQueriesData<InfiniteData<ListMessagesResponse>>(
          {
            queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
          },
          (data) => {
            if (!data) {
              return data;
            }

            return {
              ...data,
              pages: data.pages.map((page) => {
                const messages = page as LettaMessageUnion[];

                return messages.map((message) => {
                  if (
                    message.message_type === 'user_message' &&
                    message.otid === userMessageOtid
                  ) {
                    return {
                      ...message,
                      id: FAILED_ID,
                    };
                  }
                  return message;
                });
              }),
            };
          },
        );
      }

      const newMessage: SystemMessage | UserMessage =
        role.value === 'system'
          ? {
              message_type: 'system_message' as const,
              otid: userMessageOtid,
              sender_id: role.identityId || '',
              content: JSON.stringify({
                type: 'system_alert',
                message: message,
                time: new Date().toISOString(),
              }),
              date: new Date().toISOString(),
              id: `${new Date().getTime()}-user_message`,
            }
          : {
              message_type: 'user_message' as const,
              otid: userMessageOtid,
              sender_id: role.identityId || '',
              content: content,
              date: new Date().toISOString(),
              id: `${new Date().getTime()}-user_message`,
            };

      queryClient.setQueriesData<InfiniteData<ListMessagesResponse>>(
        {
          queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
        },
        (data) => {
          if (!data) {
            return data;
          }

          return {
            ...data,
            pages: data.pages.map((page) => [
              newMessage,
              ...(page as LettaMessageUnion[]).filter((v) => {
                // remove any failed messages
                if (v.id === FAILED_ID) {
                  return false;
                }

                return true;
              }),
            ]),
          };
        },
      );

      if (isLocal) {
        trackClientSideEvent(AnalyticsEvent.LOCAL_AGENT_MESSAGE_CREATED, {
          userId: '',
        });
      } else {
        trackClientSideEvent(AnalyticsEvent.CLOUD_AGENT_MESSAGE_CREATED, {
          userId: '',
        });
      }

      abortController.current = new AbortController();

      const requestBody = {
        // extra config to turn off the AssistantMessage parsing for the ADE
        config: {
          use_assistant_message: false,
        },
        stream_steps: true,
        stream_tokens: true,
        use_assistant_message: false,
        messages: [
          {
            role: role.value !== 'system' ? 'user' : 'system',
            ...(role.identityId ? { sender_id: role.identityId } : {}),
            content: content,
            otid: userMessageOtid,
          },
        ],
      };

      const requestId = addNetworkRequest({
        date: new Date(),
        url: `${baseUrl}/v1/agents/${agentId}/messages/stream`,
        method: 'POST',
        status: 200,
        payload: requestBody,
        response: 'RESULTS WILL APPEAR AFTER THE REQUEST IS COMPLETED',
      });

      try {
        const response = await fetch(
          `${baseUrl}/v1/agents/${agentId}/messages/stream`,
          {
            method: 'POST',
            headers: {
              'X-SOURCE-CLIENT': window.location.pathname,
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              ...(password
                ? {
                    Authorization: `Bearer ${password}`,
                    'X-BARE-PASSWORD': `password ${password}`,
                  }
                : {}),
            },
            body: JSON.stringify(requestBody),
            signal: abortController.current.signal,
          },
        );

        if (!response.ok) {
          const body = await response.json();

          if (body.reasons?.includes('free-usage-exceeded')) {
            handleError(message, 'FREE_USAGE_EXCEEDED');
            updateNetworkRequest(requestId, {
              status: response.status,
              response: body,
            });
            return;
          }

          if (body.reasons?.includes('agents-limit-exceeded')) {
            handleError(message, 'AGENT_LIMIT_EXCEEDED');
            updateNetworkRequest(requestId, {
              status: response.status,
              response: body,
            });
            return;
          }

          if (body.reasons?.includes('premium-usage-exceeded')) {
            handleError(message, 'PREMIUM_USAGE_EXCEEDED');
            updateNetworkRequest(requestId, {
              status: response.status,
              response: body,
            });
            return;
          }

          if (response.status === 429) {
            handleError(message, 'RATE_LIMIT_EXCEEDED');
            updateNetworkRequest(requestId, {
              status: response.status,
              response: body,
            });
            return;
          }

          if (response.status === 402) {
            handleError(message, 'CREDIT_LIMIT_EXCEEDED');
            updateNetworkRequest(requestId, {
              status: response.status,
              response: body,
            });
            return;
          }

          updateNetworkRequest(requestId, {
            status: response.status,
            response: body,
          });

          handleError(message, 'INTERNAL_SERVER_ERROR');
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          handleError(message, 'INTERNAL_SERVER_ERROR');
          return;
        }

        let buffer = '';
        let allText = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            setIsPending(false);
            void queryClient.invalidateQueries({
              queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
            });
            break;
          }

          if (abortController.current?.signal.aborted) {
            await reader.cancel();
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim() === '') continue;

            // Parse SSE format: "data: {json}" or just "{json}"
            let data = line;
            allText += `${data}\n`;
            if (line.startsWith('data: ')) {
              data = line.substring(6);
            }

            if (data.trim() === '[DONE]') {
              updateNetworkRequest(requestId, {
                status: 200,
                response: allText,
              });
              continue;
            }

            try {
              const errorMessage = ErrorMessageSchema.parse(JSON.parse(data));
              handleError(message, errorMessage.code);
              return;
            } catch (_e) {
              // ignore
            }

            try {
              // TODO (cliandy): handle {"message_type":"usage_statistics"} or don't pass through
              const extracted = AgentMessageSchema.parse(JSON.parse(data));

              queryClient.setQueriesData<InfiniteData<ListMessagesResponse>>(
                {
                  queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
                },
                (data) => {
                  if (!data) {
                    return data;
                  }

                  const messages = data.pages[0] as LettaMessageUnion[];

                  let hasExistingMessage = false;

                  let transformedMessages = messages.map((message) => {
                    if (
                      `${message.id}-${message.message_type}` ===
                      `${extracted.id}-${extracted.message_type}`
                    ) {
                      hasExistingMessage = true;

                      const newMessage: Record<string, any> = {
                        ...message,
                      };

                      // explicit handlers for each message type
                      switch (extracted.message_type) {
                        case 'tool_call_message': {
                          const maybeArguments = get(
                            newMessage,
                            'tool_call.arguments',
                            '',
                          );

                          newMessage.tool_call = {
                            tool_call_id:
                              newMessage.tool_call.tool_call_id ||
                              extracted.tool_call.tool_call_id,
                            message_type:
                              newMessage.tool_call.message_type ||
                              extracted.tool_call.message_type,
                            name:
                              newMessage.tool_call.name ||
                              extracted.tool_call.name,
                            arguments:
                              maybeArguments + extracted.tool_call.arguments,
                          };
                          break;
                        }
                        case 'tool_return_message': {
                          newMessage.tool_return = extracted.tool_return;
                          break;
                        }
                        case 'reasoning_message': {
                          newMessage.reasoning =
                            (newMessage.reasoning || '') + extracted.reasoning;
                          break;
                        }
                        default: {
                          return newMessage;
                        }
                      }

                      return newMessage;
                    }

                    return message;
                  });

                  if (!hasExistingMessage) {
                    transformedMessages = [
                      ...transformedMessages,
                      {
                        ...extracted,
                        date: new Date().toISOString(),
                      },
                    ];
                  }

                  return {
                    ...data,
                    pages: [
                      transformedMessages as LettaMessageUnion[],
                      ...data.pages.slice(1),
                    ],
                  };
                },
              );
            } catch (_e) {
              // ignore
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was aborted, don't treat as error
          setIsPending(false);
          return;
        }

        // Handle other fetch errors
        setIsPending(false);
        setFailedToSendMessage(true);
        setErrorCode('INTERNAL_SERVER_ERROR');
        options?.onFailedToSendMessage?.(message);
      }
    },
    [
      baseUrl,
      isLocal,
      options,
      password,
      queryClient,
      setIsPending,
      addNetworkRequest,
      updateNetworkRequest,
    ],
  );

  const stopMessage = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
      setIsPending(false);
    }
  }, [setIsPending]);

  return {
    isPending,
    isError: failedToSendMessage,
    sendMessage,
    stopMessage,
    errorCode,
  };
}

interface QuickAgentSimulatorOnboardingProps {
  children: React.ReactNode;
}

function QuickAgentSimulatorOnboarding(
  props: QuickAgentSimulatorOnboardingProps,
) {
  const t = useTranslations('ADE/AgentSimulator.QuickOnboarding');
  const { children } = props;

  const { currentStep } = useQuickADETour();

  if (currentStep !== 'message') {
    return <>{children}</>;
  }

  return (
    <OnboardingAsideFocus
      title={t('title')}
      placement="top-start"
      description={t('description')}
      isOpen
      totalSteps={4}
      currentStep={1}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

interface AgentSimulatorOnboardingProps {
  children: React.ReactNode;
}

function AgentSimulatorOnboarding(props: AgentSimulatorOnboardingProps) {
  const t = useTranslations('ADE/AgentSimulator');
  const { children } = props;

  const { currentStep } = useADETour();

  const { setOnboardingStep } = useSetOnboardingStep();

  if (currentStep !== 'chat') {
    return <>{children}</>;
  }

  return (
    <OnboardingAsideFocus
      className="w-full h-full"
      title={t('AgentSimulatorOnboarding.title')}
      placement="left-start"
      description={t('AgentSimulatorOnboarding.description')}
      isOpen
      totalSteps={4}
      nextStep={
        <Button
          fullWidth
          size="large"
          bold
          onClick={() => {
            setOnboardingStep({
              onboardingStep: 'save_version',
              stepToClaim: 'explore_ade',
            });
          }}
          label={t('AgentSimulatorOnboarding.next')}
        />
      }
      currentStep={4}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

function InvalidMessages() {
  const t = useTranslations('ADE/AgentSimulator');

  return (
    <VStack padding fullHeight fullWidth>
      <WarningIcon size="xxlarge" color="destructive" />
      <Typography variant="heading5">{t('InvalidMessages.title')}</Typography>
      <Typography>{t('InvalidMessages.description')}</Typography>
      {/*<Code fullHeight language="javascript" code={JSON.stringify(error, null, 2)} />*/}
    </VStack>
  );
}

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

  return data?.body.billingTier || 'enterprise';
}

export function AgentSimulator() {
  const t = useTranslations('ADE/AgentSimulator');
  const [renderMode, setRenderMode] = useLocalStorage<MessagesDisplayMode>({
    defaultValue: 'interactive',
    key: 'chatroom-render-mode',
  });

  const billingTier = useBillingTier();

  const { isLocal } = useCurrentAgentMetaData();
  const { id: agentIdToUse } = useCurrentSimulatedAgent();

  const ref = useRef<ChatInputRef | null>(null);

  const {
    sendMessage,
    stopMessage,
    isError: hasFailedToSendMessage,
    isPending,
    errorCode,
  } = useSendMessage({
    onFailedToSendMessage: (message) => {
      ref.current?.setChatMessage(message);
    },
  });

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

  return (
    <AgentSimulatorOnboarding>
      <ChatroomContext.Provider value={{ renderMode, setRenderMode }}>
        <VStack position="relative" gap={false} fullHeight fullWidth>
          <AgentSimulatorHeader />
          <VStack collapseHeight gap={false} fullWidth>
            <VStack gap="large" collapseHeight>
              <VStack collapseHeight position="relative">
                <ErrorBoundary fallback={<InvalidMessages />}>
                  <Messages
                    renderAgentsLink
                    injectSpaceForHeader
                    mode={renderMode}
                    isPanelActive
                    isSendingMessage={isPending}
                    agentId={agentIdToUse || ''}
                  />
                </ErrorBoundary>
              </VStack>
              <QuickAgentSimulatorOnboarding>
                <ChatInput
                  errorActionButton={<OpenInNetworkInspectorButton />}
                  disabled={!agentIdToUse}
                  roles={[
                    ...(identities.length > 0
                      ? identities.map((identity) => ({
                          value: identity?.identity_type || '',
                          identityId: identity?.id || '',
                          label: identity?.name || '',
                          icon: (
                            <Avatar name={identity?.name || ''} size="xsmall" />
                          ),
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
                    sendMessage({ role, content, agentId: agentIdToUse || '' });

                    if (currentStep === 'message') {
                      setStep('memory');
                    }
                  }}
                  onStopMessage={stopMessage}
                  isSendingMessage={isPending}
                />
              </QuickAgentSimulatorOnboarding>
            </VStack>
          </VStack>
        </VStack>
      </ChatroomContext.Provider>
    </AgentSimulatorOnboarding>
  );
}
