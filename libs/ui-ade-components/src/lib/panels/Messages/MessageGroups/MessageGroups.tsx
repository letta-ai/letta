import {
  Alert,
  HStack,
  IconAvatar,
  PersonIcon,
  SmallInvaderOutlineIcon,
  SystemIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { memo, useMemo } from 'react';
import { useGroupedMessages } from '../hooks/useGroupedMessages/useGroupedMessages';
import { useMessagesContext } from '../hooks/useMessagesContext/useMessagesContext';
import type { ListMessagesResponse, ToolReturnMessage } from '@letta-cloud/sdk-core';
import type { AgentSimulatorMessageGroupType } from '../../AgentSimulator/types';
import { Message } from './Message/Message';
import { deepEqual } from 'fast-equals';
import { useTranslations } from '@letta-cloud/translations';

interface MessageGroupType {
  group: AgentSimulatorMessageGroupType;
  dataAnchor?: string;
}

function MessageGroup({ group, dataAnchor }: MessageGroupType) {
  const { name, messages } = group;

  const sortedMessages = useMemo(
    () =>
      messages.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [messages],
  );

  const toolReturnMessages = useMemo(
    () =>
      sortedMessages
        .filter((message) => message.message_type === 'tool_return_message')
        .reduce((acc, message) => {
          if (message.message_type === 'tool_return_message') {
            acc[message.tool_call_id] = message;
          }

          return acc;
        }, {} as Record<string, ToolReturnMessage>),
    [sortedMessages],
  );

  const textColor = useMemo(() => {
    if (name === 'Agent') {
      return 'hsl(var(--agent-color-content))';
    }

    if (name === 'User') {
      return 'hsl(var(--user-color-content))';
    }

    return 'hsl(var(--background-grey2-content))';
  }, [name]);

  const backgroundColor = useMemo(() => {
    if (name === 'Agent') {
      return 'hsl(var(--agent-color))';
    }

    if (name === 'User') {
      return 'hsl(var(--user-color))';
    }

    return 'hsl(var(--background-grey2))';
  }, [name]);

  const icon = useMemo(() => {
    if (name === 'Agent') {
      return <SmallInvaderOutlineIcon size="xsmall" />;
    }

    if (name === 'User') {
      return <PersonIcon />;
    }

    if (name === 'System') {
      return <SystemIcon />;
    }

    return null;
  }, [name]);

  const style = useMemo(
    () => ({
      backgroundColor:
        name === 'User'
          ? 'hsl(var(--user-content-background))'
          : 'hsl(var(--agent-content-background))',
    }),
    [name],
  );

  return (
    <VStack
      paddingY="medium"
      paddingLeft="medium"
      position="relative"
      paddingRight="medium"
      /* eslint-disable-next-line react/forbid-component-props */
      style={style}
      className="message-group rounded-t-[0.375rem] gap-1.5 rounded-br-[0.375rem] w-full"
      data-testid="message-group"
      {...(dataAnchor && { 'data-anchor': dataAnchor })}
    >
      <HStack align="center" className="gap-1.5">
        <IconAvatar
          textColor={textColor}
          backgroundColor={backgroundColor}
          icon={icon}
          size={'xxsmall'}
          className="rounded-[2px]"
        />
        <Typography variant="body4" className="tracking-[0.04em] font-bold">
          {name.toUpperCase()}
        </Typography>
      </HStack>
      <VStack
        gap="medium"
        data-testid={`${name.toLowerCase()}-message-content`}
      >
        {sortedMessages.map((message, index) => {
          const toolReturnMessage =
            message.message_type === 'tool_call_message' &&
            'tool_call_id' in message.tool_call
              ? toolReturnMessages[message.tool_call.tool_call_id || '']
              : undefined;


          return (
            <Message
              key={`${message.id}_${index}`}
              message={message}
              toolReturnMessage={toolReturnMessage}
            />
          );
        })}
      </VStack>
    </VStack>
  );
}

interface MessageGroupsProps {
  messages: ListMessagesResponse;
  hasNextPage?: boolean;
}

export const MessageGroups = memo(
  function MessageGroups(props: MessageGroupsProps) {
    const { messages, hasNextPage = false } = props;

    const { mode } = useMessagesContext();

    const t = useTranslations('components/Messages');

    const messageGroups = useGroupedMessages({
      messages,
    });

    return (
      <>
        {messageGroups.map((group, index) => (
          <MessageGroup
            key={index}
            group={group}
            dataAnchor={index === 0 ? 'old-first' : undefined}
          />
        ))}
        {hasNextPage && messageGroups.length === 0 && mode === 'simple' && (
          <Alert variant="info" title={t('noParsableMessages')} />
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    return deepEqual(prevProps, nextProps);
  },
);
