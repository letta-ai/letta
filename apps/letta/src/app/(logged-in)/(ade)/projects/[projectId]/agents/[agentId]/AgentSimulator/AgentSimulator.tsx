import {
  Button,
  Frame,
  HStack,
  LettaLoader,
  Panel,
  Typography,
  usePanelContext,
  VStack,
} from '@letta-web/component-library';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentMessage } from '@letta-web/letta-agents-api';
import {
  AgentMessageSchema,
  UseAgentsServiceListAgentMessagesKeyFn,
} from '@letta-web/letta-agents-api';
import { useCurrentAgent } from '../hooks';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import TextareaAutosize from 'react-textarea-autosize';
import { SendHorizonalIcon } from 'lucide-react';
import { EventSource } from 'extended-eventsource';
import { useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { get } from 'lodash-es';
import { cn } from '@letta-web/core-style-config';
import { Messages } from '$letta/client/components';

function useSendMessage() {
  const { id } = useCurrentAgent();
  const [isPending, setIsPending] = React.useState(false);
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

      const eventsource = new EventSource(
        `/letta-agents-api/v1/agents/${id}/messages`,
        {
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
        }
      );

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

interface ChatInputProps {
  sendMessage: (message: string) => void;
  isSendingMessage: boolean;
}

function ChatInput(props: ChatInputProps) {
  const { sendMessage, isSendingMessage } = props;
  const [text, setText] = useState('');

  const handleSendMessage = useCallback(() => {
    if (isSendingMessage) {
      return;
    }
    if (text) {
      setText('');
      sendMessage(text);
    }
  }, [isSendingMessage, sendMessage, text]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLElement>) => {
      e.preventDefault();
      handleSendMessage();
    },
    [handleSendMessage]
  );

  return (
    <Frame position="relative" paddingX="medium" paddingBottom>
      <HStack
        gap="small"
        align="center"
        position="absolute"
        className={cn(
          'mt-[-25px] fade-out-0 fade-in-10 z-[0] transition-all duration-200 slide-in-from-bottom-10',
          isSendingMessage ? '' : 'mt-0'
        )}
      >
        <div>
          <LettaLoader size="small" color="muted" />
        </div>
        <Typography color="muted" bold>
          Agent is Typing...
        </Typography>
      </HStack>
      <VStack
        color="background"
        onSubmit={handleSubmit}
        as="form"
        className="z-[1] relative focus-within:ring-ring focus-within:ring-1"
        rounded
        border
        fullWidth
        padding="large"
        borderTop
      >
        <TextareaAutosize
          data-testid="chat-simulator-input"
          onChange={(e) => {
            setText(e.target.value);
          }}
          value={text}
          onKeyDown={handleKeyPress}
          className="w-full text-base font-inherit resize-none	focus:outline-none"
          maxRows={10}
          minRows={2}
          placeholder="Type a message here"
        />
        <HStack justify="spaceBetween">
          <div />
          <Button
            data-testid="chat-simulator-send"
            size="small"
            type="submit"
            color="secondary"
            preIcon={<SendHorizonalIcon />}
            disabled={isSendingMessage}
            label="Send"
          />
        </HStack>
      </VStack>
    </Frame>
  );
}

function Chatroom() {
  const { sendMessage, isPending } = useSendMessage();
  const { id: agentId } = useCurrentAgent();
  const { isPanelActive } = usePanelContext();

  return (
    <VStack fullHeight gap={false} fullWidth>
      <VStack gap="large" collapseHeight>
        <Messages
          isPanelActive={isPanelActive}
          isSendingMessage={isPending}
          agentId={agentId}
        />
        <ChatInput sendMessage={sendMessage} isSendingMessage={isPending} />
      </VStack>
    </VStack>
  );
}

export function AgentSimulator() {
  return (
    <Panel
      id="chat-simulator"
      trigger={<ADENavigationItem title="Chat Simulator" />}
      title="Simulator"
    >
      <Chatroom />
    </Panel>
  );
}
