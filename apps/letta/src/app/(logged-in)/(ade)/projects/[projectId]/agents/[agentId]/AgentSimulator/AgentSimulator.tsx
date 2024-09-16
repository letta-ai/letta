import {
  Avatar,
  Button,
  Code,
  Frame,
  HStack,
  LettaLoader,
  Panel,
  PanelBar,
  Typography,
  usePanelContext,
  VStack,
} from '@letta-web/component-library';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AgentMessage } from '@letta-web/letta-agents-api';
import {
  AgentMessageSchema,
  AgentsService,
  type ListAgentMessagesResponse,
  UseAgentsServiceListAgentMessagesKeyFn,
  UserMessageMessageSchema,
} from '@letta-web/letta-agents-api';
import { useCurrentAgent } from '../hooks';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import TextareaAutosize from 'react-textarea-autosize';
import { FunctionSquareIcon, SendHorizonalIcon } from 'lucide-react';
import type {
  AgentSimulatorMessageGroupType,
  AgentSimulatorMessageType,
} from './types';
import { EventSource } from 'extended-eventsource';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { get } from 'lodash-es';
import { cn } from '@letta-web/core-style-config';

interface MessageWrapperProps {
  header: React.ReactNode;
  children: React.ReactNode;
}

function MessageWrapper({ header, children }: MessageWrapperProps) {
  return (
    <VStack fullWidth border rounded>
      <HStack borderBottom padding="small">
        {header}
      </HStack>
      <VStack paddingBottom="small" paddingX="small">
        {children}
      </VStack>
    </VStack>
  );
}

function extractMessage(
  agentMessage: AgentMessage
): AgentSimulatorMessageType | null {
  switch (agentMessage.message_type) {
    case 'function_return':
      return {
        id: `${agentMessage.id}-${agentMessage.message_type}`,
        content: (
          <MessageWrapper
            header={
              <>
                <Typography bold>Function Response</Typography>
                <Typography
                  bold
                  color={
                    agentMessage.status === 'success'
                      ? 'positive'
                      : 'destructive'
                  }
                >
                  [{agentMessage.status}]
                </Typography>
              </>
            }
          >
            <Code
              variant="minimal"
              showLineNumbers={false}
              code={agentMessage.function_return}
              language="javascript"
            ></Code>
          </MessageWrapper>
        ),
        timestamp: new Date(agentMessage.date).toISOString(),
        name: 'Agent',
      };
    case 'function_call':
      return {
        id: `${agentMessage.id}-${agentMessage.message_type}`,
        content: (
          <MessageWrapper
            header={
              <>
                <FunctionSquareIcon />
                <Typography bold>{agentMessage.function_call.name}</Typography>
              </>
            }
          >
            <HStack>
              <Code
                variant="minimal"
                showLineNumbers={false}
                code={JSON.stringify(agentMessage.function_call, null, 2)}
                language="javascript"
              ></Code>
            </HStack>
          </MessageWrapper>
        ),
        timestamp: new Date(agentMessage.date).toISOString(),
        name: 'Agent',
      };
    case 'internal_monologue':
      return {
        id: `${agentMessage.id}-${agentMessage.message_type}`,
        content: (
          <MessageWrapper
            header={
              <>
                🤔
                <Typography bold>Internal Monologue</Typography>
              </>
            }
          >
            <pre className="text-xs whitespace-pre-wrap">
              {agentMessage.internal_monologue}
            </pre>
          </MessageWrapper>
        ),
        timestamp: new Date(agentMessage.date).toISOString(),
        name: 'Agent',
      };
    case 'user_message': {
      const out = UserMessageMessageSchema.safeParse(
        JSON.parse(agentMessage.message)
      );

      if (!out.success) {
        return {
          id: `${agentMessage.id}-${agentMessage.message_type}`,
          content: agentMessage.message,
          timestamp: new Date(agentMessage.date).toISOString(),
          name: 'User',
        };
      }

      return {
        id: `${agentMessage.id}-${agentMessage.message_type}`,
        content: out.data.message,
        timestamp: new Date(agentMessage.date).toISOString(),
        name: 'User',
      };
    }

    case 'system_message':
      return null;
  }
}

interface MessageProps {
  message: AgentSimulatorMessageType;
}

function Message({ message }: MessageProps) {
  return <HStack fullWidth>{message.content}</HStack>;
}

interface MessageGroupType {
  group: AgentSimulatorMessageGroupType;
}

function MessageGroup({ group }: MessageGroupType) {
  const { name, messages } = group;

  const sortedMessages = messages.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <HStack>
      <Avatar name={name} />
      <VStack fullWidth gap="small">
        <Typography bold>{name}</Typography>
        <VStack gap="large">
          {sortedMessages.map((message, index) => (
            <Message key={`${message.id}_${index}`} message={message} />
          ))}
        </VStack>
      </VStack>
    </HStack>
  );
}

const MESSAGE_LIMIT = 20;

interface MessagesProps {
  isSendingMessage: boolean;
}

function Messages(props: MessagesProps) {
  const { isSendingMessage } = props;
  const ref = useRef<HTMLDivElement>(null);
  const hasScrolledInitially = useRef(false);

  const { id } = useCurrentAgent();
  const { data, hasNextPage, fetchNextPage, isFetching } = useInfiniteQuery<
    AgentMessage[],
    Error,
    InfiniteData<ListAgentMessagesResponse>,
    unknown[],
    { before?: string }
  >({
    queryKey: UseAgentsServiceListAgentMessagesKeyFn({ agentId: id }),
    queryFn: async (query) => {
      const res = AgentsService.listAgentMessages({
        agentId: id,
        limit: MESSAGE_LIMIT,
        ...(query.pageParam.before ? { before: query.pageParam.before } : {}),
      });

      return res as unknown as AgentMessage[];
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.length < MESSAGE_LIMIT) {
        return undefined;
      }

      return {
        before: lastPage.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )[0].id,
      };
    },
    initialPageParam: { before: '' },
  });

  const messageGroups = useMemo(() => {
    if (!data) {
      return [];
    }

    const preMessages = data.pages
      .flat()
      // @ts-expect-error - the typing is wrong
      .map((message) => extractMessage(message))
      .filter((message) => !!message)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

    // group messages by name

    const groupedMessages: AgentSimulatorMessageGroupType[] = [];

    preMessages.forEach((message, index) => {
      const lastGroup = groupedMessages[groupedMessages.length - 1];
      const nextMessage = {
        id: message.id || '',
        content: message.content || '',
        name: message.name,
        timestamp: message.timestamp || '',
      };

      if (index !== 0 && lastGroup.name === message.name) {
        lastGroup.messages.unshift(nextMessage);
      } else {
        groupedMessages.push({
          id: message.id || '1',
          name: message.name,
          messages: [nextMessage],
        });
      }
    });

    return groupedMessages;
  }, [data]);

  const { isPanelActive } = usePanelContext();

  useEffect(() => {
    if (ref.current) {
      if (messageGroups.length > 0) {
        setTimeout(() => {
          if (!ref.current) {
            return;
          }

          if (!hasScrolledInitially.current) {
            ref.current.scrollTop = ref.current.scrollHeight;
            hasScrolledInitially.current = true;
          }
        }, 10);
      }

      if (isSendingMessage) {
        ref.current.scrollTop = ref.current.scrollHeight;
      }
    }
  }, [messageGroups, isPanelActive, isSendingMessage]);

  return (
    <VStack
      ref={ref}
      fullWidth
      collapseHeight
      overflowY="auto"
      gap="xlarge"
      padding="large"
    >
      {hasNextPage && (
        <Button
          busy={isFetching}
          onClick={() => {
            void fetchNextPage();
          }}
          fullWidth
          color="tertiary"
          label="Load more"
        />
      )}
      {messageGroups.map((group) => (
        <MessageGroup key={group.id} group={group} />
      ))}
    </VStack>
  );
}

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
        } catch (e) {
          console.error(e);
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

  return (
    <VStack fullHeight gap={false} fullWidth>
      <PanelBar>
        <HStack
          fullWidth
          paddingX="small"
          align="center"
          justify="spaceBetween"
        >
          <Typography>Agent</Typography>
          <HStack>
            <Button color="tertiary" size="small" label="Options" />
          </HStack>
        </HStack>
      </PanelBar>
      <VStack gap="large" collapseHeight>
        <Messages isSendingMessage={isPending} />
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
