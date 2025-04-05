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
} from '@letta-cloud/ui-component-library';
import type { ChatInputRef } from '@letta-cloud/ui-component-library';
import { PanelBar } from '@letta-cloud/ui-component-library';
import { VStack } from '@letta-cloud/ui-component-library';
import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMemo } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import type {
  AgentState,
  LettaMessageUnion,
  ListMessagesResponse,
  SystemMessage,
  UserMessage,
} from '@letta-cloud/sdk-core';
import { v4 as uuidv4 } from 'uuid';
import { useAgentsServiceResetMessages } from '@letta-cloud/sdk-core';
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

type ErrorCode = z.infer<typeof ErrorMessageSchema>['code'];

interface SendMessagePayload {
  role: string;
  content: string;
}

export type SendMessageType = (payload: SendMessagePayload) => void;

interface UseSendMessageOptions {
  onFailedToSendMessage?: (existingMessage: string) => void;
}

function errorHasResponseAndStatus(
  e: unknown,
): e is { response: { status: number } } {
  return Object.prototype.hasOwnProperty.call(e, 'response');
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
        console.log('aborting');
        abortController.current.abort();
      }
    };
  }, []);

  const sendMessage: SendMessageType = useCallback(
    (payload: SendMessagePayload) => {
      const { content: message, role } = payload;
      setIsPending(true);
      setFailedToSendMessage(false);
      setErrorCode(undefined);

      const userMessageOtid = uuidv4();

      const newMessage: SystemMessage | UserMessage = {
        message_type: role === 'user' ? 'user_message' : 'system_message',
        otid: userMessageOtid,
        content:
          role === 'user'
            ? message
            : JSON.stringify({
                type: 'system_alert',
                message: message,
                time: new Date().toISOString(),
              }),
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
              ...(page as LettaMessageUnion[]),
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
                role,
                content: message,
                otid: userMessageOtid,
              },
            ],
          }),
        },
      );

      eventsource.addEventListener('error', (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (errorHasResponseAndStatus(e)) {
          if (e.response.status === 429) {
            setIsPending(false);
            setFailedToSendMessage(true);
            setErrorCode('RATE_LIMIT_EXCEEDED');
            options?.onFailedToSendMessage?.(message);
            return;
          }

          if (e.response.status === 402) {
            setIsPending(false);
            setFailedToSendMessage(true);
            setErrorCode('CREDIT_LIMIT_EXCEEDED');
            options?.onFailedToSendMessage?.(message);
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

        if (['DONE_GEN', 'DONE_STEP', 'DONE'].includes(e.data)) {
          return;
        }

        try {
          const errorMessage = ErrorMessageSchema.parse(JSON.parse(e.data));
          setIsPending(false);
          setFailedToSendMessage(!!errorMessage.error);
          setErrorCode(errorMessage.code);
          options?.onFailedToSendMessage?.(message);
          return;
        } catch (_e) {
          // ignore
        }

        try {
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
                  {
                    ...extracted,
                    date: new Date().toISOString(),
                  },
                  ...transformedMessages,
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

  return { isPending, isError: failedToSendMessage, sendMessage, errorCode };
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
          color="secondary"
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

  const { id: agentId } = useCurrentSimulatedAgent();

  const {
    mutate: resetMessages,
    isPending,
    reset,
  } = useAgentsServiceResetMessages({
    onSuccess: () => {
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
                labelVariant="simple"
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
            color="secondary"
            preIcon={<DotsHorizontalIcon />}
            hideLabel
            title={t('AgentSimulatorOptionsMenu.trigger')}
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

export function AgentSimulator() {
  const t = useTranslations('ADE/AgentSimulator');
  const agentState = useCurrentAgent();
  const { id: agentId } = agentState;
  const [renderMode, setRenderMode] = useLocalStorage<MessagesDisplayMode>({
    defaultValue: 'interactive',
    key: 'chatroom-render-mode',
  });

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
      case 'CREDIT_LIMIT_EXCEEDED':
        return t.rich('hasFailedToSendMessageText.creditLimitExceeded', {
          link: (chunks) => {
            return <Link href="/settings/organization/billing">{chunks}</Link>;
          },
        });
      case 'INTERNAL_SERVER_ERROR':
      default:
        if (isLocal) {
          return t('hasFailedToSendMessageText.local');
        }
        return t('hasFailedToSendMessageText.cloud');
    }
  }, [hasFailedToSendMessage, isLocal, t, errorCode]);

  const { isTemplate } = useCurrentAgentMetaData();
  const hostConfig = useCurrentAPIHostConfig({
    isLocal,
    attachApiKey: false,
  });
  const getSendSnippet = useCallback(
    (role: string, message: string) => {
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
          messages: [{ role, content: message }],
          stream_steps: true,
          stream_tokens: true,
        },
        method: 'POST',
      });
    },
    [agentIdToUse, hostConfig.headers, hostConfig.url, isTemplate],
  );

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
                    color="secondary"
                    label={t('showVariables')}
                    size="small"
                  />
                }
              />
            </VStack>
          </PanelBar>
          <VStack collapseHeight gap={false} fullWidth>
            <VStack gap="large" collapseHeight>
              <VStack collapseHeight position="relative">
                <Messages
                  renderAgentsLink
                  mode={renderMode}
                  isPanelActive
                  isSendingMessage={isPending}
                  agentId={agentIdToUse || ''}
                />
              </VStack>
              <ChatInput
                disabled={!agentIdToUse}
                defaultRole="user"
                roles={[
                  {
                    value: 'user',
                    label: t('role.user'),
                    icon: <PersonIcon />,
                    color: {
                      background: 'hsl(var(--user-color))',
                      text: 'hsl(var(--user-color-content))',
                    },
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
                onSendMessage={(role: string, content: string) => {
                  sendMessage({ role, content });
                }}
                isSendingMessage={isPending}
              />
            </VStack>
          </VStack>
        </VStack>
      </ChatroomContext.Provider>
    </AgentSimulatorOnboarding>
  );
}
