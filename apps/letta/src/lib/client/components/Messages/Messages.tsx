'use client';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Badge,
  Button,
  Code,
  FunctionCall,
  HStack,
  IconAvatar,
  SystemIcon,
  Markdown,
  PersonIcon,
  LettaInvaderIcon,
  ThoughtsIcon,
  Typography,
  VStack,
  MessageWrapper,
  LoadingEmptyStatusComponent,
  BlockQuote,
  InnerMonologueIcon,
} from '@letta-web/component-library';
import type { AgentMessage } from '@letta-web/letta-agents-api';
import { SystemAlertSchema } from '@letta-web/letta-agents-api';
import { SendMessageFunctionCallSchema } from '@letta-web/letta-agents-api';
import {
  type ListAgentMessagesResponse,
  UseAgentsServiceListAgentMessagesKeyFn,
  UserMessageMessageSchema,
} from '@letta-web/letta-agents-api';
import type {
  AgentSimulatorMessageGroupType,
  AgentSimulatorMessageType,
} from '../../../../app/(logged-in)/(ade)/projects/[projectSlug]/agents/[agentId]/AgentSimulator/types';
import { FunctionIcon } from '@letta-web/component-library';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { jsonrepair } from 'jsonrepair';
import { useTranslations } from 'next-intl';
import { get } from 'lodash-es';
import { useGetMessagesWorker } from '$letta/client/components/Messages/useGetMessagesWorker/useGetMessagesWorker';
import { useCurrentDevelopmentServerConfig } from '../../../../app/(logged-in)/(dashboard-like)/development-servers/[developmentServerId]/hooks/useCurrentDevelopmentServerConfig/useCurrentDevelopmentServerConfig';
import { useAtom } from 'jotai';
import { firstPageMessagesCache } from '$letta/client/components/Messages/firstPageMessagesCache/firstPageMessagesCache';

// tryFallbackParseJson will attempt to parse a string as JSON, if it fails, it will trim the last character and try again
// until it succeeds or the string is empty
function tryFallbackParseJson(str: string): unknown {
  let trimmed = str;

  while (trimmed.length > 0) {
    try {
      return JSON.parse(jsonrepair(trimmed));
    } catch (_e) {
      trimmed = trimmed.slice(0, -1);
    }
  }

  return null;
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

  const textColor = useMemo(() => {
    if (name === 'Agent') {
      return 'hsl(var(--primary-light-content))';
    }

    if (name === 'User') {
      return 'hsl(var(--user-color-content))';
    }

    return 'hsl(var(--background-grey2-content))';
  }, [name]);

  const backgroundColor = useMemo(() => {
    if (name === 'Agent') {
      return 'hsl(var(--primary-light))';
    }

    if (name === 'User') {
      return 'hsl(var(--user-color))';
    }

    return 'hsl(var(--background-grey2))';
  }, [name]);

  const icon = useMemo(() => {
    if (name === 'Agent') {
      return <LettaInvaderIcon />;
    }

    if (name === 'User') {
      return <PersonIcon />;
    }

    if (name === 'System') {
      return <SystemIcon />;
    }

    return null;
  }, [name]);

  return (
    <HStack gap="medium">
      <IconAvatar
        textColor={textColor}
        backgroundColor={backgroundColor}
        icon={icon}
        size={'xsmall'}
      />
      <VStack collapseWidth flex gap="small">
        <Typography bold uppercase variant="body2" color="lighter">
          {name}
        </Typography>
        <VStack gap="large">
          {sortedMessages.map((message, index) => (
            <Message key={`${message.id}_${index}`} message={message} />
          ))}
        </VStack>
      </VStack>
    </HStack>
  );
}

const MESSAGE_LIMIT = 50;

export type MessagesDisplayMode = 'debug' | 'interactive' | 'simple';

interface MessagesProps {
  isSendingMessage: boolean;
  agentId: string;
  mode: MessagesDisplayMode;
  isPanelActive?: boolean;
}

interface LastMessageReceived {
  id: string;
  date: number;
}

export function Messages(props: MessagesProps) {
  const { isSendingMessage, mode, isPanelActive, agentId } = props;
  const ref = useRef<HTMLDivElement>(null);
  const hasScrolledInitially = useRef(false);
  const t = useTranslations('components/Messages');
  const [lastMessageReceived, setLastMessageReceived] =
    useState<LastMessageReceived | null>(null);

  const developmentServerConfig = useCurrentDevelopmentServerConfig();
  const { getMessages } = useGetMessagesWorker();

  const isMessageUpdateLock = useMemo(() => {
    return isSendingMessage;
  }, [isSendingMessage]);

  const refetchInterval = useMemo(() => {
    if (isSendingMessage) {
      return false;
    }

    // last sent message was less than 10 seconds ago refetch every 500ms;

    if (lastMessageReceived && Date.now() - lastMessageReceived.date < 10000) {
      return 500;
    }

    return 5000;
  }, [isSendingMessage, lastMessageReceived]);

  const [messageCache, setMessageCache] = useAtom(firstPageMessagesCache);

  const { data, hasNextPage, fetchNextPage, isFetching } = useInfiniteQuery<
    AgentMessage[],
    Error,
    InfiniteData<ListAgentMessagesResponse>,
    unknown[],
    { before?: string }
  >({
    refetchInterval,
    queryKey: UseAgentsServiceListAgentMessagesKeyFn({ agentId }),
    queryFn: async (query) => {
      const res = (await getMessages({
        url: developmentServerConfig?.url,
        headers: {
          ...(developmentServerConfig?.password
            ? {
                'X-BARE-PASSWORD': `password ${developmentServerConfig.password}`,
              }
            : {}),
        },
        agentId,
        limit: MESSAGE_LIMIT,
        ...(query.pageParam.before ? { cursor: query.pageParam.before } : {}),
      })) as unknown as AgentMessage[];

      if (isMessageUpdateLock) {
        return messageCache;
      }

      setMessageCache(res);

      return res;
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
    enabled: !isSendingMessage && !!agentId,
    initialPageParam: { before: '' },
  });

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (data.pages.length === 0) {
      return;
    }

    // most recent message is the first message in the first page
    const mostRecentMessage = data.pages[0][0];

    if (
      mostRecentMessage.id !== lastMessageReceived?.id &&
      'date' in mostRecentMessage
    ) {
      setLastMessageReceived({
        id: mostRecentMessage.id,
        date: new Date(mostRecentMessage.date).getTime(),
      });
    }
  }, [data?.pages, lastMessageReceived?.id]);

  const extractMessage = useCallback(
    function extractMessage(
      agentMessage: AgentMessage,
      mode: MessagesDisplayMode,
      allMessages: AgentMessage[]
    ): AgentSimulatorMessageType | null {
      switch (agentMessage.message_type) {
        case 'function_return':
          if (mode === 'simple') {
            return null;
          }

          if (mode === 'interactive') {
            return null;
          }

          return {
            id: `${agentMessage.id}-${agentMessage.message_type}`,
            content: (
              <MessageWrapper
                type="code"
                header={{
                  title: t('functionReturn'),

                  badge: (
                    <Badge
                      size="small"
                      content={agentMessage.status}
                      color={
                        agentMessage.status === 'success'
                          ? 'success'
                          : 'destructive'
                      }
                    ></Badge>
                  ),
                }}
              >
                <Code
                  fontSize="small"
                  variant="minimal"
                  showLineNumbers={false}
                  code={JSON.stringify(
                    {
                      ...agentMessage,
                      function_return: tryFallbackParseJson(
                        agentMessage.function_return
                      ),
                    },
                    null,
                    2
                  )}
                  language="javascript"
                ></Code>
              </MessageWrapper>
            ),
            timestamp: new Date(agentMessage.date).toISOString(),
            name: 'Agent',
          };
        case 'function_call': {
          const parsedFunctionCallArguments = tryFallbackParseJson(
            agentMessage.function_call.arguments || ''
          );

          if (mode === 'simple' || mode === 'interactive') {
            if (
              agentMessage.function_call.name === 'send_message' &&
              agentMessage.function_call.arguments
            ) {
              try {
                const out = SendMessageFunctionCallSchema.safeParse(
                  tryFallbackParseJson(
                    agentMessage.function_call.arguments || ''
                  )
                );

                if (!out.success) {
                  throw new Error('Unable to parse message');
                }

                return {
                  id: `${agentMessage.id}-${agentMessage.message_type}`,
                  content: (
                    <VStack>
                      <Markdown text={out.data.message} />
                    </VStack>
                  ),
                  name: 'Agent',
                  timestamp: new Date(agentMessage.date).toISOString(),
                };
              } catch (_e) {
                return {
                  id: `${agentMessage.id}-${agentMessage.message_type}`,
                  content: '',
                  timestamp: new Date(agentMessage.date).toISOString(),
                  name: 'Agent',
                };
              }
            }

            if (mode === 'interactive') {
              const functionResponse = allMessages.find(
                (message) =>
                  message.message_type === 'function_return' &&
                  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
                  get(message, 'function_call_id') ===
                    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
                    agentMessage.function_call.function_call_id
              );

              return {
                id: `${agentMessage.id}-${agentMessage.message_type}`,
                content: (
                  <FunctionCall
                    name={agentMessage.function_call.name || ''}
                    inputs={agentMessage.function_call.arguments || ''}
                    response={get(functionResponse, 'function_return')}
                    status={get(functionResponse, 'status')}
                  />
                ),
                timestamp: new Date(agentMessage.date).toISOString(),
                name: 'Agent',
              };
            }

            return null;
          }

          return {
            id: `${agentMessage.id}-${agentMessage.message_type}`,
            content: (
              <MessageWrapper
                type="code"
                header={{
                  title: agentMessage.function_call.name || '',
                  preIcon: <FunctionIcon />,
                }}
              >
                <Code
                  fontSize="small"
                  variant="minimal"
                  showLineNumbers={false}
                  code={JSON.stringify(
                    {
                      ...agentMessage.function_call,
                      arguments:
                        parsedFunctionCallArguments ||
                        agentMessage.function_call.arguments,
                    },
                    null,
                    2
                  )}
                  language="javascript"
                ></Code>
              </MessageWrapper>
            ),
            timestamp: new Date(agentMessage.date).toISOString(),
            name: 'Agent',
          };
        }
        case 'internal_monologue':
          if (mode === 'simple') {
            return null;
          }

          if (mode === 'interactive') {
            return {
              id: `${agentMessage.id}-${agentMessage.message_type}`,
              content: (
                <BlockQuote>
                  <VStack gap="small">
                    <HStack align="center" gap="small">
                      <InnerMonologueIcon color="violet" size="small" />
                      <Typography bold color="violet" variant="body2">
                        {t('thoughts')}
                      </Typography>
                    </HStack>
                    <Typography>{agentMessage.internal_monologue}</Typography>
                  </VStack>
                </BlockQuote>
              ),
              timestamp: new Date(agentMessage.date).toISOString(),
              name: 'Agent',
            };
          }

          return {
            id: `${agentMessage.id}-${agentMessage.message_type}`,
            content: (
              <MessageWrapper
                type="internalMonologue"
                header={{
                  preIcon: <ThoughtsIcon />,
                  title: t('internalMonologue'),
                }}
              >
                <Typography>{agentMessage.internal_monologue}</Typography>
              </MessageWrapper>
            ),
            timestamp: new Date(agentMessage.date).toISOString(),
            name: 'Agent',
          };
        case 'user_message': {
          const out = UserMessageMessageSchema.safeParse(
            JSON.parse(agentMessage.message)
          );

          if (mode === 'simple' || mode === 'interactive') {
            if (!out.success) {
              return null;
            }

            return {
              id: `${agentMessage.id}-${agentMessage.message_type}`,
              content: (
                <VStack>
                  <Markdown text={out.data.message} />
                </VStack>
              ),
              timestamp: new Date(agentMessage.date).toISOString(),
              name: 'User',
            };
          }

          if (!out.success) {
            const tryParseResp = tryFallbackParseJson(agentMessage.message);

            if (tryParseResp) {
              return {
                id: `${agentMessage.id}-${agentMessage.message_type}`,
                content: (
                  <MessageWrapper
                    type="code"
                    header={{
                      title: t('hiddenUserMessage'),
                    }}
                  >
                    <Code
                      fontSize="small"
                      variant="minimal"
                      showLineNumbers={false}
                      code={JSON.stringify(tryParseResp, null, 2)}
                      language="javascript"
                    ></Code>
                  </MessageWrapper>
                ),
                timestamp: new Date(agentMessage.date).toISOString(),
                name: 'User',
              };
            }

            return {
              id: `${agentMessage.id}-${agentMessage.message_type}`,
              content: <Typography>{agentMessage.message}</Typography>,
              timestamp: new Date(agentMessage.date).toISOString(),
              name: 'User',
            };
          }

          return {
            id: `${agentMessage.id}-${agentMessage.message_type}`,
            content: <Typography>{out.data.message}</Typography>,
            timestamp: new Date(agentMessage.date).toISOString(),
            name: 'User',
          };
        }

        case 'system_message': {
          if (mode === 'simple') {
            return null;
          }

          try {
            const tryParseResp = SystemAlertSchema.safeParse(
              JSON.parse(agentMessage.message)
            );

            if (tryParseResp.success) {
              return {
                id: `${agentMessage.id}-${agentMessage.message_type}`,
                content: <Typography>{tryParseResp.data.message}</Typography>,
                timestamp: new Date(agentMessage.date).toISOString(),
                name: 'System',
              };
            }
          } catch (_e) {
            return null;
          }

          return null;
        }
      }
    },
    [t]
  );

  const messageGroups = useMemo(() => {
    if (!data) {
      return [];
    }

    const preMessages = data.pages
      .flat()
      .map((message, _, allMessages) =>
        // @ts-expect-error - the typing is wrong
        extractMessage(message, mode, allMessages)
      )
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
  }, [extractMessage, mode, data]);

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
      data-testid="messages-list"
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
      {hasNextPage && messageGroups.length === 0 && mode === 'simple' && (
        <Alert variant="info" title={t('noParsableMessages')} />
      )}
      {!data && (
        <LoadingEmptyStatusComponent
          loadingMessage={t('loadingMessages')}
          hideText
          loaderVariant="grower"
        />
      )}
    </VStack>
  );
}
