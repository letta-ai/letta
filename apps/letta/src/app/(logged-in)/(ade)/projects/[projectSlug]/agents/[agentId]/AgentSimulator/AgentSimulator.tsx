'use client';
import {
  ChatBubbleIcon,
  ChatInput,
  CodeIcon,
  RawToggleGroup,
} from '@letta-web/component-library';
import type { PanelTemplate } from '@letta-web/component-library';
import { PanelBar } from '@letta-web/component-library';
import { VStack } from '@letta-web/component-library';
import type { Dispatch, SetStateAction } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentMessage } from '@letta-web/letta-agents-api';
import {
  AgentMessageSchema,
  UseAgentsServiceListAgentMessagesKeyFn,
} from '@letta-web/letta-agents-api';
import { useCurrentAgent } from '../hooks';
import { EventSource } from 'extended-eventsource';
import { useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { get } from 'lodash-es';
import type { MessagesDisplayMode } from '$letta/client/components';
import { Messages } from '$letta/client/components';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useLocalStorage } from '@mantine/hooks';

function useSendMessage() {
  const { id } = useCurrentAgent();
  const [isPending, setIsPending] = useState(false);
  const abortController = useRef<AbortController>();
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  const sendMessage = useCallback(
    (message: string) => {
      setIsPending(true);

      queryClient.setQueriesData<InfiniteData<AgentMessage[]> | undefined>(
        {
          queryKey: UseAgentsServiceListAgentMessagesKeyFn({ agentId: id }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          const [firstPage, ...rest] = [...oldData.pages];

          const newMessage: AgentMessage = {
            message_type: 'user_message',
            message: JSON.stringify({
              type: 'user_message',
              message: message,
              time: new Date().toISOString(),
            }),
            date: new Date().toISOString(),
            id: `${new Date().getTime()}-user_message`,
          };

          return {
            pageParams: oldData.pageParams,
            pages: [[newMessage, ...firstPage], ...rest],
          };
        }
      );

      abortController.current = new AbortController();

      const eventsource = new EventSource(`/v1/agents/${id}/messages`, {
        withCredentials: true,
        method: 'POST',
        disableRetry: true,
        keepalive: false,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          stream_steps: true,
          stream_tokens: true,
          messages: [
            {
              role: 'user',
              text: message,
              name: '',
            },
          ],
        }),
      });

      eventsource.onmessage = (e: MessageEvent) => {
        if (abortController.current?.signal.aborted) {
          return;
        }

        if (['DONE_GEN', 'DONE_STEP', 'DONE'].includes(e.data)) {
          return;
        }

        try {
          const extracted = AgentMessageSchema.parse(JSON.parse(e.data));

          queryClient.setQueriesData<InfiniteData<AgentMessage[]>>(
            {
              queryKey: UseAgentsServiceListAgentMessagesKeyFn({ agentId: id }),
            },
            // @ts-expect-error - the typing is wrong
            (oldData) => {
              if (!oldData) {
                return oldData;
              }

              const [firstPage, ...rest] = [...oldData.pages];

              let hasExistingMessage = false;

              let transformedFirstPage = firstPage.map((message) => {
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
                    case 'function_call': {
                      const maybeArguments = get(
                        newMessage,
                        'function_call.arguments',
                        ''
                      );

                      newMessage.function_call = {
                        message_type:
                          newMessage.function_call.message_type ||
                          extracted.function_call.message_type,
                        name:
                          newMessage.function_call.name ||
                          extracted.function_call.name,
                        arguments:
                          maybeArguments + extracted.function_call.arguments,
                      };
                      break;
                    }
                    case 'function_return': {
                      newMessage.function_return = extracted.function_return;
                      break;
                    }
                    case 'internal_monologue': {
                      newMessage.internal_monologue =
                        (newMessage.internal_monologue || '') +
                        extracted.internal_monologue;
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
                transformedFirstPage = [
                  {
                    ...extracted,
                    date: new Date().toISOString(),
                  },
                  ...transformedFirstPage,
                ];
              }

              return {
                pageParams: oldData.pageParams,
                pages: [transformedFirstPage, ...rest],
              };
            }
          );
        } catch (_e) {
          // ignore
        }

        if (e.eventPhase === eventsource.CLOSED) {
          void queryClient.invalidateQueries({
            queryKey: UseAgentsServiceListAgentMessagesKeyFn({ agentId: id }),
          });

          setIsPending(false);
          return;
        }
      };

      eventsource.onerror = () => {
        setIsPending(false);
      };
    },
    [id, queryClient]
  );

  return { isPending, sendMessage };
}

interface ChatroomContextType {
  renderMode: MessagesDisplayMode;
  setRenderMode: Dispatch<SetStateAction<ChatroomContextType['renderMode']>>;
}

const ChatroomContext = React.createContext<ChatroomContextType>({
  renderMode: 'debug',
  setRenderMode: () => {
    return;
  },
});

function ControlChatroomRenderMode() {
  const t = useTranslations('ADE/AgentSimulator');
  const { renderMode, setRenderMode } = React.useContext(ChatroomContext);

  return (
    <RawToggleGroup
      size="small"
      border
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
          icon: <ChatBubbleIcon />,
          label: t('setChatroomRenderMode.options.simple'),
          value: 'simple',
          hideLabel: true,
        },
      ]}
    />
  );
}

function ChatroomPanelBar() {
  return <PanelBar actions={<ControlChatroomRenderMode />}></PanelBar>;
}

function Chatroom() {
  const t = useTranslations('ADE/AgentSimulator');
  const { sendMessage, isPending } = useSendMessage();
  const { id: agentId } = useCurrentAgent();
  const [renderMode, setRenderMode] = useLocalStorage<MessagesDisplayMode>({
    defaultValue: 'debug',
    key: 'chatroom-render-mode',
  });

  return (
    <ChatroomContext.Provider value={{ renderMode, setRenderMode }}>
      <VStack fullHeight fullWidth>
        <ChatroomPanelBar />
        <VStack collapseHeight gap={false} fullWidth>
          <VStack gap="large" collapseHeight>
            <Messages
              mode={renderMode}
              isPanelActive
              isSendingMessage={isPending}
              agentId={agentId}
            />
            <ChatInput
              sendingMessageText={t('sendingMessage')}
              onSendMessage={sendMessage}
              isSendingMessage={isPending}
            />
          </VStack>
        </VStack>
      </VStack>
    </ChatroomContext.Provider>
  );
}

export const agentSimulatorTemplate = {
  templateId: 'agent-simulator',
  useGetTitle: () => 'Agent Simulator',
  content: Chatroom,
  data: z.undefined(),
} satisfies PanelTemplate<'agent-simulator'>;
