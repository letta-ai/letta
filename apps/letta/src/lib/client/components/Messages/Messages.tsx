import React, { useEffect, useMemo, useRef } from 'react';
import {
  Avatar,
  Button,
  Code,
  HStack,
  LettaLoaderPanel,
  Typography,
  VStack,
} from '@letta-web/component-library';
import type { AgentMessage } from '@letta-web/letta-agents-api';
import {
  AgentsService,
  type ListAgentMessagesResponse,
  UseAgentsServiceListAgentMessagesKeyFn,
  UserMessageMessageSchema,
} from '@letta-web/letta-agents-api';
import type {
  AgentSimulatorMessageGroupType,
  AgentSimulatorMessageType,
} from '../../../../app/(logged-in)/(ade)/projects/[projectId]/agents/[agentId]/AgentSimulator/types';
import { FunctionSquareIcon } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';

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
  agentId: string;
  isPanelActive?: boolean;
}

export function Messages(props: MessagesProps) {
  const { isSendingMessage, isPanelActive, agentId } = props;
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
