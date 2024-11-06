'use client';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Code,
  HStack,
  IconAvatar,
  InlineCode,
  LettaLoaderPanel,
  Markdown,
  PersonIcon,
  RobotIcon,
  ThoughtsIcon,
  Typography,
  VStack,
} from '@letta-web/component-library';
import type { AgentMessage } from '@letta-web/letta-agents-api';
import { SendMessageFunctionCallSchema } from '@letta-web/letta-agents-api';
import {
  AgentsService,
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
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

const messageWrapperVariants = cva('', {
  variants: {
    type: {
      code: 'bg-background-grey',
      internalMonologue: 'bg-background-violet text-background-violet-content',
      default: 'bg-background',
    },
  },
  defaultVariants: {
    type: 'default',
  },
});

interface MessageWrapperProps
  extends VariantProps<typeof messageWrapperVariants> {
  header: React.ReactNode;
  children: React.ReactNode;
}

function MessageWrapper({ header, type, children }: MessageWrapperProps) {
  return (
    <VStack fullWidth rounded gap={false}>
      <HStack>
        <HStack
          paddingX="small"
          paddingY="xxsmall"
          /* eslint-disable-next-line react/forbid-component-props */
          className={cn(messageWrapperVariants({ type }))}
          align="center"
        >
          {header}
        </HStack>
      </HStack>
      <VStack
        /* eslint-disable-next-line react/forbid-component-props */
        className={cn(
          messageWrapperVariants({ type }),
          type === 'code' ? 'bg-background border' : ''
        )}
        paddingY="small"
        paddingX="small"
      >
        {children}
      </VStack>
    </VStack>
  );
}

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

  return (
    <HStack>
      <IconAvatar
        textColor={
          name === 'Agent'
            ? 'hsl(var(--primary-light-content))'
            : 'hsl(var(--background-grey-content))'
        }
        backgroundColor={
          name === 'Agent'
            ? 'hsl(var(--primary-light))'
            : 'hsl(var(--background-grey))'
        }
        icon={name === 'Agent' ? <RobotIcon /> : <PersonIcon />}
      />
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

export type MessagesDisplayMode = 'debug' | 'interactive' | 'simple';

interface MessagesProps {
  isSendingMessage: boolean;
  agentId: string;
  mode: MessagesDisplayMode;
  isPanelActive?: boolean;
}

export function Messages(props: MessagesProps) {
  const { isSendingMessage, mode, isPanelActive, agentId } = props;
  const ref = useRef<HTMLDivElement>(null);
  const hasScrolledInitially = useRef(false);
  const t = useTranslations('components/Messages');

  const { data, hasNextPage, fetchNextPage, isFetching } = useInfiniteQuery<
    AgentMessage[],
    Error,
    InfiniteData<ListAgentMessagesResponse>,
    unknown[],
    { before?: string }
  >({
    queryKey: UseAgentsServiceListAgentMessagesKeyFn({ agentId }),
    queryFn: async (query) => {
      const res = AgentsService.listAgentMessages({
        agentId,
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

  const extractMessage = useCallback(
    function extractMessage(
      agentMessage: AgentMessage,
      mode: MessagesDisplayMode
    ): AgentSimulatorMessageType | null {
      switch (agentMessage.message_type) {
        case 'function_return':
          if (mode === 'simple') {
            return null;
          }

          if (mode === 'interactive') {
            if (agentMessage.function_return.includes('"message": "None",')) {
              return null;
            }

            return {
              id: agentMessage.id,
              content: (
                <HStack border fullWidth>
                  <Accordion
                    id={agentMessage.id}
                    trigger={
                      <HStack>
                        <Typography>Function Result</Typography>
                      </HStack>
                    }
                  >
                    <Code
                      fontSize="small"
                      variant="minimal"
                      showLineNumbers={false}
                      code={agentMessage.function_return}
                      language="javascript"
                    ></Code>
                  </Accordion>
                </HStack>
              ),
              timestamp: new Date(agentMessage.date).toISOString(),
              name: 'Agent',
            };
          }

          return {
            id: `${agentMessage.id}-${agentMessage.message_type}`,
            content: (
              <MessageWrapper
                type="code"
                header={
                  <>
                    <Typography bold>Function Response</Typography>
                    <Badge
                      content={agentMessage.status}
                      color={
                        agentMessage.status === 'success'
                          ? 'success'
                          : 'destructive'
                      }
                    ></Badge>
                  </>
                }
              >
                <Code
                  fontSize="small"
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
              return {
                id: `${agentMessage.id}-${agentMessage.message_type}`,
                content: (
                  <InlineCode
                    code={`${
                      agentMessage.function_call.name || 'Unknown Function'
                    }()`}
                    hideCopyButton
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
                header={
                  <>
                    <FunctionIcon />
                    <Typography bold>
                      {agentMessage.function_call.name}
                    </Typography>
                  </>
                }
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
                <Typography italic>
                  {agentMessage.internal_monologue}
                </Typography>
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
                header={
                  <>
                    <ThoughtsIcon />
                    <Typography bold>Internal Monologue</Typography>
                  </>
                }
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
                    header={
                      <>
                        <Typography bold>{t('hiddenUserMessage')}</Typography>
                      </>
                    }
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

        case 'system_message':
          return null;
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
      // @ts-expect-error - the typing is wrong
      .map((message) => extractMessage(message, mode))
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
      {!data && <LettaLoaderPanel />}
    </VStack>
  );
}
