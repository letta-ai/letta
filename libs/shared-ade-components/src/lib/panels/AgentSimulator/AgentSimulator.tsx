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
} from '@letta-cloud/component-library';
import type { ChatInputRef } from '@letta-cloud/component-library';
import { PanelBar } from '@letta-cloud/component-library';
import { VStack } from '@letta-cloud/component-library';
import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMemo } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import type { AgentMessage, AgentState } from '@letta-cloud/letta-agents-api';
import { isAgentState } from '@letta-cloud/letta-agents-api';
import { ErrorMessageSchema } from '@letta-cloud/letta-agents-api';
import { useLettaAgentsAPI } from '@letta-cloud/letta-agents-api';
import { getIsAgentState } from '@letta-cloud/letta-agents-api';
import { AgentsService } from '@letta-cloud/letta-agents-api';
import { useAgentsServiceGetAgentSources } from '@letta-cloud/letta-agents-api';
import {
  AgentMessageSchema,
  UseAgentsServiceListAgentMessagesKeyFn,
} from '@letta-cloud/letta-agents-api';
import { useCurrentAgent } from '../../hooks';
import { EventSource } from 'extended-eventsource';
import { useQueryClient } from '@tanstack/react-query';
import { get } from 'lodash-es';
import type { z } from 'zod';
import { useTranslations } from '@letta-cloud/translations';
import { useDebouncedCallback, useLocalStorage } from '@mantine/hooks';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import { webOriginSDKApi } from '@letta-cloud/letta-agents-api';
import {
  compareAgentStates,
  findMemoryBlockVariables,
} from '@letta-cloud/generic-utils';
import { useCurrentSimulatedAgent } from '../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { useCurrentAgentMetaData } from '../../hooks';
import { atom, useAtom, useSetAtom } from 'jotai';
import { trackClientSideEvent } from '@letta-cloud/analytics/client';
import { AnalyticsEvent } from '@letta-cloud/analytics';
import { jsonToCurl } from '@letta-cloud/generic-utils';
import type { GetAgentTemplateSimulatorSessionResponseBody } from '@letta-cloud/web-api-client';
import { messagesInFlightCacheAtom } from '../Messages/messagesInFlightCacheAtom/messagesInFlightCacheAtom';
import { Messages } from '../Messages/Messages';
import type { MessagesDisplayMode } from '../Messages/Messages';
import { useCurrentAPIHostConfig } from '@letta-cloud/helpful-client-utils';
import { AgentVariablesModal } from './AgentVariablesModal/AgentVariablesModal';

const isSendingMessageAtom = atom(false);

type ErrorCode = z.infer<typeof ErrorMessageSchema>['code'];

interface SendMessagePayload {
  role: string;
  text: string;
}

export type SendMessageType = (payload: SendMessagePayload) => void;

interface UseSendMessageOptions {
  onFailedToSendMessage?: (existingMessage: string) => void;
}

function useSendMessage(agentId: string, options: UseSendMessageOptions = {}) {
  const [isPending, setIsPending] = useAtom(isSendingMessageAtom);
  const abortController = useRef<AbortController>(undefined);
  const queryClient = useQueryClient();
  const { isLocal } = useCurrentAgentMetaData();
  const [failedToSendMessage, setFailedToSendMessage] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>(undefined);

  const { baseUrl, password } = useLettaAgentsAPI();
  const setMessagesInFlightCache = useSetAtom(messagesInFlightCacheAtom);

  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
        setMessagesInFlightCache({});
      }
    };
  }, [setMessagesInFlightCache]);

  const sendMessage: SendMessageType = useCallback(
    (payload: SendMessagePayload) => {
      const { text: message, role } = payload;
      setIsPending(true);
      setFailedToSendMessage(false);
      setErrorCode(undefined);

      const newMessage: AgentMessage = {
        message_type: role === 'user' ? 'user_message' : 'system_message',
        message: JSON.stringify({
          type: role === 'user' ? 'user_message' : 'system_alert',
          message: message,
          time: new Date().toISOString(),
        }),
        date: new Date().toISOString(),
        id: `${new Date().getTime()}-user_message`,
      };

      setMessagesInFlightCache({
        [agentId]: [newMessage],
      });

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
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(password ? { 'X-BARE-PASSWORD': `password ${password}` } : {}),
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
                text: message,
              },
            ],
          }),
        },
      );

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

          setMessagesInFlightCache((obj) => {
            const messages = obj[agentId];

            if (!messages) {
              return messages;
            }

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
                      arguments: maybeArguments + extracted.tool_call.arguments,
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
              [agentId]: transformedMessages as AgentMessage[],
            };
          });
        } catch (_e) {
          // ignore
        }

        if (e.eventPhase === eventsource.CLOSED) {
          void queryClient.invalidateQueries({
            queryKey: UseAgentsServiceListAgentMessagesKeyFn({ agentId }),
          });

          setIsPending(false);
          return;
        }
      };

      eventsource.onerror = () => {
        setIsPending(false);
      };
    },
    [
      agentId,
      baseUrl,
      isLocal,
      options,
      password,
      queryClient,
      setMessagesInFlightCache,
      setIsPending,
    ],
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

  const { id: agentId } = useCurrentSimulatedAgent();

  const handlePrintDebug = useCallback(async () => {
    if (!agentId) {
      toast.error(t('AgentSimulatorOptionsMenu.options.printDebug.notReady'));

      return;
    }

    const [agentState, sources] = await Promise.all([
      webOriginSDKApi.agents.getAgentById.query({
        params: {
          agent_id: agentId,
        },
        query: {
          all: true,
        },
      }),
      AgentsService.getAgentSources({
        agentId: agentId,
      }),
    ]);

    console.table({
      agentState,
      sources,
    });

    toast.success(t('AgentSimulatorOptionsMenu.options.printDebug.success'));
  }, [agentId, t]);

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
        <DropdownMenuItem
          onClick={handlePrintDebug}
          label={t('AgentSimulatorOptionsMenu.options.printDebug.title')}
        />
      </DropdownMenu>
    </>
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

  const { data: sourceList } = useAgentsServiceGetAgentSources({
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
          messages: [{ role, text: message }],
          stream_steps: true,
          stream_tokens: true,
        },
        method: 'POST',
      });
    },
    [agentIdToUse, hostConfig.headers, hostConfig.url, isTemplate],
  );

  return (
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
              onSendMessage={(role: string, text: string) => {
                sendMessage({ role, text });
              }}
              isSendingMessage={isPending}
            />
          </VStack>
        </VStack>
      </VStack>
    </ChatroomContext.Provider>
  );
}
