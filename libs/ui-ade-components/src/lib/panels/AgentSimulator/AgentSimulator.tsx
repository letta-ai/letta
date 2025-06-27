'use client';
import {
  Button,
  ChatBubbleIcon,
  ChatInput,
  ChatIcon,
  CodeIcon,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  HStack,
  PersonIcon,
  RawToggleGroup,
  SystemIcon,
  toast,
  Typography,
  VariableIcon,
  WarningIcon,
  FlushIcon,
  useForm,
  FormProvider,
  FormField,
  Checkbox,
  Link,
  OnboardingAsideFocus,
  Avatar,
} from '@letta-cloud/ui-component-library';
import type {
  ChatInputRef,
  RoleOption,
} from '@letta-cloud/ui-component-library';
import { PanelBar } from '@letta-cloud/ui-component-library';
import { VStack } from '@letta-cloud/ui-component-library';
import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMemo } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import type {
  AgentState,
  Identity,
  LettaUserMessageContentUnion,
  LettaMessageUnion,
  ListMessagesResponse,
  SystemMessage,
  UserMessage,
} from '@letta-cloud/sdk-core';
import { v4 as uuidv4 } from 'uuid';
import {
  IdentitiesService,
  useAgentsServiceResetMessages,
} from '@letta-cloud/sdk-core';
import { isAgentState } from '@letta-cloud/sdk-core';
import { ErrorMessageSchema } from '@letta-cloud/sdk-core';
import { getIsAgentState } from '@letta-cloud/sdk-core';
import { useAgentsServiceListAgentSources } from '@letta-cloud/sdk-core';
import {
  AgentMessageSchema,
  UseAgentsServiceListMessagesKeyFn,
} from '@letta-cloud/sdk-core';
import { useCurrentAgent } from '../../hooks';
import { EventSource } from 'extended-eventsource';
import { useQueryClient } from '@tanstack/react-query';
import { get } from 'lodash-es';
import { z } from 'zod';
import { useTranslations } from '@letta-cloud/translations';
import { useDebouncedCallback, useLocalStorage } from '@mantine/hooks';
import {
  useSetOnboardingStep,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import {
  compareAgentStates,
  findMemoryBlockVariables,
} from '@letta-cloud/utils-shared';
import { useCurrentSimulatedAgent } from '../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { useCurrentAgentMetaData } from '../../hooks';
import { useAtom } from 'jotai';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { jsonToCurl } from '@letta-cloud/utils-shared';
import type { GetAgentTemplateSimulatorSessionResponseBody } from '@letta-cloud/sdk-web';
import { Messages } from '../Messages/Messages';
import type { MessagesDisplayMode } from '../Messages/Messages';
import {
  useCurrentAPIHostConfig,
  useLettaAgentsAPI,
} from '@letta-cloud/utils-client';
import { AgentVariablesModal } from './AgentVariablesModal/AgentVariablesModal';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShareAgentDialog } from './ShareAgentDialog/ShareAgentDialog';
import { isSendingMessageAtom } from './atoms';
import { useADETour } from '../../hooks/useADETour/useADETour';
import type { InfiniteData } from '@tanstack/query-core';
import { ErrorBoundary } from 'react-error-boundary';
import type { RateLimitReason } from '@letta-cloud/types';

type ErrorCode = z.infer<typeof ErrorMessageSchema>['code'];

interface SendMessagePayload {
  role: RoleOption;
  content: LettaUserMessageContentUnion[] | string;
}

const FAILED_ID = 'failed';
export type SendMessageType = (payload: SendMessagePayload) => void;

interface UseSendMessageOptions {
  onFailedToSendMessage?: (existingMessage: string) => void;
}

function errorHasResponseAndStatus(e: unknown): e is {
  response: {
    status: number;
    json: () => Promise<{ reasons: RateLimitReason[] }>;
  };
} {
  return Object.prototype.hasOwnProperty.call(e, 'response');
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

export function useSendMessage(
  agentId: string,
  options: UseSendMessageOptions = {},
) {
  const [isPending, setIsPending] = useAtom(isSendingMessageAtom);
  const abortController = useRef<AbortController>(undefined);
  const queryClient = useQueryClient();
  const { isLocal } = useCurrentAgentMetaData();
  const [failedToSendMessage, setFailedToSendMessage] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>(undefined);

  const { baseUrl, password } = useLettaAgentsAPI();

  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  const sendMessage: SendMessageType = useCallback(
    (payload: SendMessagePayload) => {
      const { content, role } = payload;
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

      const eventsource = new EventSource(
        `${baseUrl}/v1/agents/${agentId}/messages/stream`,
        {
          withCredentials: true,
          method: 'POST',
          disableRetry: true,
          keepalive: false,
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
          body: JSON.stringify({
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
          }),
        },
      );

      eventsource.addEventListener('error', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        // tag user sent message as errored

        if (errorHasResponseAndStatus(e)) {
          const body = await e.response.json();

          if (body.reasons?.includes('free-usage-exceeded')) {
            handleError(message, 'FREE_USAGE_EXCEEDED');
            return;
          }

          if (body.reasons?.includes('agents-limit-exceeded')) {
            handleError(message, 'AGENT_LIMIT_EXCEEDED');
            return;
          }

          if (body.reasons?.includes('premium-usage-exceeded')) {
            handleError(message, 'PREMIUM_USAGE_EXCEEDED');
            return;
          }

          if (e.response.status === 429) {
            handleError(message, 'RATE_LIMIT_EXCEEDED');
            return;
          }

          if (e.response.status === 402) {
            handleError(message, 'CREDIT_LIMIT_EXCEEDED');
            return;
          }
        }

        // temp disable, I dont think this is working properly
        // setIsPending(false);
        // setFailedToSendMessage(true);
        // setErrorCode('INTERNAL_SERVER_ERROR');
        // options?.onFailedToSendMessage?.(message);
      });

      eventsource.onmessage = (e: MessageEvent) => {
        if (abortController.current?.signal.aborted) {
          return;
        }

        if (e.data.trim() === '[DONE]') {
          return;
        }

        try {
          const errorMessage = ErrorMessageSchema.parse(JSON.parse(e.data));
          handleError(message, errorMessage.code);
          return;
        } catch (_e) {
          // ignore
        }

        try {
          // TODO (cliandy): handle {"message_type":"usage_statistics"} or don't pass through
          const extracted = AgentMessageSchema.parse(JSON.parse(e.data));

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
                          newMessage.tool_call.name || extracted.tool_call.name,
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

        if (e.eventPhase === eventsource.CLOSED) {
          void queryClient.invalidateQueries({
            queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
          });

          setIsPending(false);
          return;
        }
      };

      eventsource.onerror = () => {
        setIsPending(false);
      };
    },
    [agentId, baseUrl, isLocal, options, password, queryClient, setIsPending],
  );

  const stopMessage = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
      setIsPending(false);
    }
  }, [setIsPending]);

  return { isPending, isError: failedToSendMessage, sendMessage, stopMessage, errorCode };
}

interface ChatroomContextType {
  renderMode: MessagesDisplayMode;
  setRenderMode: Dispatch<SetStateAction<ChatroomContextType['renderMode']>>;
}

const ChatroomContext = React.createContext<ChatroomContextType>({
  renderMode: 'interactive',
  setRenderMode: () => {
    return;
  },
});

function ControlChatroomRenderMode() {
  const t = useTranslations('ADE/AgentSimulator');
  const { renderMode, setRenderMode } = React.useContext(ChatroomContext);

  return (
    <RawToggleGroup
      border
      size="small"
      onValueChange={(value) => {
        if (value) {
          setRenderMode(value as MessagesDisplayMode);
        }
      }}
      value={renderMode}
      label={t('setChatroomRenderMode.label')}
      hideLabel
      items={[
        {
          icon: <CodeIcon />,
          label: t('setChatroomRenderMode.options.debug'),
          value: 'debug',
          hideLabel: true,
        },
        {
          icon: <ChatIcon />,
          label: t('setChatroomRenderMode.options.interactive'),
          value: 'interactive',
          hideLabel: true,
        },
        {
          icon: <ChatBubbleIcon />,
          label: t('setChatroomRenderMode.options.simple'),
          value: 'simple',
          hideLabel: true,
        },
      ]}
    />
  );
}

function FlushSimulationSessionDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('ADE/AgentSimulator');
  const queryClient = useQueryClient();
  const { agentId: agentTemplateId } = useCurrentAgentMetaData();
  const { agentSession } = useCurrentSimulatedAgent();

  const { mutate: createSession, isPending: isCreatingNewSession } =
    webApi.agentTemplates.createAgentTemplateSimulatorSession.useMutation({
      onSuccess: (response) => {
        toast.success(t('FlushSimulationSessionDialog.success'));

        queryClient.setQueriesData<GetAgentTemplateSimulatorSessionResponseBody>(
          {
            queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateSession({
              agentTemplateId,
            }),
          },
          () => {
            return {
              status: 200,
              body: response.body,
            };
          },
        );

        setIsOpen(false);
      },
    });

  const { mutate, isPending: isDeletingSession } =
    webApi.agentTemplates.deleteAgentTemplateSimulatorSession.useMutation({
      onSuccess: async () => {
        createSession({
          params: {
            agentTemplateId,
          },
          body: {
            memoryVariables: agentSession?.body.memoryVariables || {},
            toolVariables: agentSession?.body.toolVariables || {},
          },
        });
      },
      onError: () => {
        toast.error(t('FlushSimulationSessionDialog.error'));
      },
    });

  const isPending = useMemo(() => {
    return isCreatingNewSession || isDeletingSession;
  }, [isCreatingNewSession, isDeletingSession]);

  const handleFlushSession = useCallback(() => {
    mutate({
      params: {
        agentTemplateId,
        agentSessionId: agentSession?.body.id || '',
      },
    });
  }, [agentSession?.body.id, agentTemplateId, mutate]);

  return (
    <Dialog
      isConfirmBusy={isPending}
      isOpen={isOpen}
      trigger={
        <Button
          size="small"
          color="tertiary"
          preIcon={<FlushIcon />}
          hideLabel
          label={t('FlushSimulationSessionDialog.trigger')}
        />
      }
      title={t('FlushSimulationSessionDialog.title')}
      confirmText={t('FlushSimulationSessionDialog.confirm')}
      onConfirm={handleFlushSession}
      onOpenChange={setIsOpen}
    >
      <Typography>{t('FlushSimulationSessionDialog.description')}</Typography>
    </Dialog>
  );
}

const AgentResetMessagesSchema = z.object({
  addDefaultInitialMessages: z.boolean(),
});

type AgentResetMessagesPayload = z.infer<typeof AgentResetMessagesSchema>;

function AgentResetMessagesDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('ADE/AgentSimulator');

  const form = useForm<AgentResetMessagesPayload>({
    resolver: zodResolver(AgentResetMessagesSchema),
    defaultValues: {
      addDefaultInitialMessages: true,
    },
  });

  const queryClient = useQueryClient();

  const { id: agentId } = useCurrentSimulatedAgent();

  const {
    mutate: resetMessages,
    isPending,
    reset,
  } = useAgentsServiceResetMessages({
    onSuccess: async () => {
      await queryClient.resetQueries({
        queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
      });
      toast.success(t('AgentResetMessagesDialog.success'));
      form.reset();
      reset();
      setIsOpen(false);
    },
    onError: () => {
      toast.error(t('AgentResetMessagesDialog.error'));
    },
  });

  const handleResetMessages = useCallback(
    (values: AgentResetMessagesPayload) => {
      resetMessages({
        agentId,
        addDefaultInitialMessages: values.addDefaultInitialMessages,
      });
    },
    [agentId, resetMessages],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        isConfirmBusy={isPending}
        isOpen={isOpen}
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            label={t('AgentResetMessagesDialog.trigger')}
          />
        }
        title={t('AgentResetMessagesDialog.title')}
        confirmText={t('AgentResetMessagesDialog.confirm')}
        onSubmit={form.handleSubmit(handleResetMessages)}
        onOpenChange={setIsOpen}
      >
        <Typography>{t('AgentResetMessagesDialog.description')}</Typography>
        <HStack padding="small" paddingBottom="xxsmall" border fullWidth>
          <FormField
            name="addDefaultInitialMessages"
            render={({ field }) => (
              <Checkbox
                label={t('AgentResetMessagesDialog.addDefaultInitialMessages')}
                onCheckedChange={field.onChange}
                checked={field.value}
              />
            )}
          />
        </HStack>
      </Dialog>
    </FormProvider>
  );
}

function AgentFlushButton() {
  const { isTemplate } = useCurrentAgentMetaData();
  const { agentSession } = useCurrentSimulatedAgent();

  if (!(isTemplate && agentSession?.body.agentId)) {
    return null;
  }

  return <FlushSimulationSessionDialog />;
}

function AgentSimulatorOptionsMenu() {
  const t = useTranslations('ADE/AgentSimulator');
  const { isLocal, isTemplate } = useCurrentAgentMetaData();

  return (
    <>
      <DropdownMenu
        triggerAsChild
        align="end"
        trigger={
          <Button
            size="small"
            color="tertiary"
            preIcon={<DotsHorizontalIcon />}
            hideLabel
            label={t('AgentSimulatorOptionsMenu.trigger')}
          />
        }
      >
        <AgentResetMessagesDialog />
        {!isLocal && !isTemplate && <ShareAgentDialog />}
      </DropdownMenu>
    </>
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
  const agentState = useCurrentAgent();
  const { id: agentId } = agentState;
  const [renderMode, setRenderMode] = useLocalStorage<MessagesDisplayMode>({
    defaultValue: 'interactive',
    key: 'chatroom-render-mode',
  });

  const billingTier = useBillingTier();

  const variableList = useMemo(() => {
    if (!getIsAgentState(agentState)) {
      return [];
    }

    return findMemoryBlockVariables(agentState);
  }, [agentState]);

  const { isLocal } = useCurrentAgentMetaData();
  const { id: agentIdToUse, agentSession } = useCurrentSimulatedAgent();

  const mounted = useRef(false);

  const hasVariableMismatch = useMemo(() => {
    // check if variable mismatch
    const sessionVariables = agentSession?.body.memoryVariables || {};

    // it's ok if there's more variables defined in the session than in the agent, but not the other way around
    return variableList.some((variable) => !sessionVariables[variable]);
  }, [agentSession?.body.memoryVariables, variableList]);

  const agentStateStore = useRef<AgentState>(agentState as AgentState);

  const { mutate: updateSession } =
    webApi.agentTemplates.refreshAgentTemplateSimulatorSession.useMutation({
      onError: () => {
        toast.error(t('refreshError'));
      },
    });

  const { data: sourceList } = useAgentsServiceListAgentSources({
    agentId: agentState.id || '',
  });

  const debounceUpdateSession = useDebouncedCallback(updateSession, 2000);

  useEffect(() => {
    if (!agentSession?.body.id) {
      return;
    }

    // update session just in case
    if (!mounted.current) {
      debounceUpdateSession({
        params: {
          agentSessionId: agentSession.body.id,
          agentTemplateId: agentId,
        },
      });
    }

    mounted.current = true;
  }, [agentId, agentSession?.body.id, debounceUpdateSession, updateSession]);

  useEffect(() => {
    if (!agentSession?.body.id) {
      return;
    }

    if (!isAgentState(agentState)) {
      return;
    }

    // check if the agent state has changed
    if (compareAgentStates(agentState, agentStateStore.current)) {
      return;
    }

    agentStateStore.current = agentState;

    // update the existing session
    debounceUpdateSession({
      params: {
        agentSessionId: agentSession?.body.id,
        agentTemplateId: agentId,
      },
    });
  }, [
    agentId,
    agentSession?.body.id,
    agentState,
    debounceUpdateSession,
    sourceList,
  ]);

  const ref = useRef<ChatInputRef | null>(null);

  const {
    sendMessage,
    stopMessage,
    isError: hasFailedToSendMessage,
    isPending,
    errorCode,
  } = useSendMessage(agentIdToUse || '', {
    onFailedToSendMessage: (message) => {
      ref.current?.setChatMessage(message);
    },
  });

  const hasVariableIssue = useMemo(() => {
    return hasVariableMismatch;
  }, [hasVariableMismatch]);

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

  return (
    <AgentSimulatorOnboarding>
      <ChatroomContext.Provider value={{ renderMode, setRenderMode }}>
        <VStack gap={false} fullHeight fullWidth>
          <PanelBar
            actions={
              <HStack>
                <ControlChatroomRenderMode />
                <AgentFlushButton />
                <AgentSimulatorOptionsMenu />
              </HStack>
            }
          >
            <VStack paddingLeft="small">
              <HStack>
                <AgentVariablesModal
                  trigger={
                    <Button
                      data-testid="toggle-variables-button"
                      preIcon={
                        hasVariableIssue ? (
                          <WarningIcon color="warning" />
                        ) : (
                          <VariableIcon />
                        )
                      }
                      color="tertiary"
                      label={t('showVariables')}
                      size="small"
                    />
                  }
                />
              </HStack>
            </VStack>
          </PanelBar>
          <VStack collapseHeight gap={false} fullWidth>
            <VStack gap="large" collapseHeight>
              <VStack collapseHeight position="relative">
                <ErrorBoundary fallback={<InvalidMessages />}>
                  <Messages
                    renderAgentsLink
                    mode={renderMode}
                    isPanelActive
                    isSendingMessage={isPending}
                    agentId={agentIdToUse || ''}
                  />
                </ErrorBoundary>
              </VStack>
              <ChatInput
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
                onSendMessage={(
                  role: RoleOption,
                  content: LettaUserMessageContentUnion[] | string,
                ) => {
                  sendMessage({ role, content });
                }}
                onStopMessage={stopMessage}
                isSendingMessage={isPending}
              />
            </VStack>
          </VStack>
        </VStack>
      </ChatroomContext.Provider>
    </AgentSimulatorOnboarding>
  );
}
