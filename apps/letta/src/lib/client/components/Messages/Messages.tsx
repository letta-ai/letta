import React, { useEffect, useMemo, useRef } from 'react';
import {
  Button,
  Code,
  HStack,
  IconAvatar,
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

function extractMessage(
  agentMessage: AgentMessage,
  mode: MessagesDisplayMode
): AgentSimulatorMessageType | null {
  switch (agentMessage.message_type) {
    case 'function_return':
      if (mode === 'simple') {
        return null;
      }

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
      if (mode === 'simple') {
        if (
          agentMessage.function_call.name === 'send_message' &&
          agentMessage.function_call.arguments
        ) {
          try {
            const out = SendMessageFunctionCallSchema.safeParse(
              tryFallbackParseJson(agentMessage.function_call.arguments)
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
              content: 'Unable to parse message',
              timestamp: new Date(agentMessage.date).toISOString(),
              name: 'Agent',
            };
          }
        }

        return null;
      }

      return {
        id: `${agentMessage.id}-${agentMessage.message_type}`,
        content: (
          <MessageWrapper
            header={
              <>
                <FunctionIcon />
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
      if (mode === 'simple') {
        return null;
      }

      return {
        id: `${agentMessage.id}-${agentMessage.message_type}`,
        content: (
          <MessageWrapper
            header={
              <>
                <ThoughtsIcon />
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

      if (mode === 'simple') {
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
        color={
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

export type MessagesDisplayMode = 'debug' | 'simple';

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
  }, [mode, data]);

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
      {messageGroups.length === 0 && <LettaLoaderPanel />}
    </VStack>
  );
}
