import {
  Alert,
  HStack,
  IconAvatar,
  LettaInvaderIcon,
  PersonIcon,
  SystemIcon,
  ThinkingIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { memo, useMemo } from 'react';
import { useGroupedMessages } from '../hooks/useGroupedMessages/useGroupedMessages';
import type { ListMessagesResponse, ToolReturnMessage } from '@letta-cloud/sdk-core';
import type { AgentSimulatorMessageGroupType } from '../../AgentSimulator/types';
import { Message } from './Message/Message';
import { useTranslations } from '@letta-cloud/translations';
import type { MessagesDisplayMode } from '../types';
import { MessageGroupContextProvider } from '../hooks/useMessageGroupContext/useMessageGroupContext';
import { deepEqual } from 'fast-equals';
import { cn } from '@letta-cloud/ui-styles';

interface MessageGroupType {
  group: AgentSimulatorMessageGroupType;
  dataAnchor?: string;
  mode: MessagesDisplayMode;
  isSendingMessage?: boolean;
}

function MessageGroup({
  group,
  dataAnchor,
  isSendingMessage,
  mode,
}: MessageGroupType) {
  const { name, messages } = group;

  const t = useTranslations('components/Messages');

  const sortedMessages = useMemo(() => {
    let nextMessages = messages.filter((message) => {
      return message.id !== 'sending-message-placeholder';
    });

    if (mode !== 'debug') {
      return nextMessages.filter(
        (m) => m.message_type !== 'tool_return_message',
      );
    }

    return nextMessages;
  }, [messages, mode]);

  const toolReturnMessages = useMemo(
    () =>
      messages
        .filter((message) => message.message_type === 'tool_return_message')
        .reduce(
          (acc, message) => {
            if (message.message_type === 'tool_return_message') {
              acc[message.tool_call_id] = message;
            }

            return acc;
          },
          {} as Record<string, ToolReturnMessage>,
        ),
    [messages],
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
      if (isSendingMessage) {
        return (
          <ThinkingIcon size="xsmall" className="w-[10px]" color="inherit" />
        );
      }

      return <LettaInvaderIcon size="xsmall" />;
    }

    if (name === 'User') {
      return <PersonIcon />;
    }

    if (name === 'System') {
      return <SystemIcon />;
    }

    return null;
  }, [name, isSendingMessage]);

  const renderedName = useMemo(() => {
    if (sortedMessages.length === 0) {
      return t('agentIsThinking');
    }

    return name;
  }, [sortedMessages.length, name, t]);

  const style = useMemo(() => {
    if (sortedMessages.length === 0) {
      return {
        backgroundColor: 'transparent',
        borderColor: 'hsl(var(--agent-content-background))',
      };
    }

    return {
      backgroundColor:
        name === 'User'
          ? 'hsl(var(--user-content-background))'
          : 'hsl(var(--agent-content-background))',
    };
  }, [name, sortedMessages.length]);
  return (
    <MessageGroupContextProvider key={mode} mode={mode}>
      <VStack
        paddingY="medium"
        paddingLeft="medium"
        position="relative"
        paddingRight="medium"
        /* eslint-disable-next-line react/forbid-component-props */
        style={style}
        className="message-group rounded-t-[0.375rem] border border-transparent transition-colors gap-1.5 rounded-br-[0.375rem] w-full"
        data-testid="message-group"
        {...(dataAnchor && { 'data-anchor': dataAnchor })}
      >
        <HStack justify="spaceBetween" fullWidth>
          <HStack align="center" className="gap-1.5">
            <IconAvatar
              textColor={textColor}
              backgroundColor={backgroundColor}
              icon={icon}
              size={'xxsmall'}
              className="rounded-[2px]"
            />
            <Typography
              color={sortedMessages.length === 0 ? 'muted' : 'inherit'}
              uppercase
              variant="body4"
              className={cn('tracking-[0.04em] font-bold')}
            >
              {renderedName}
            </Typography>
          </HStack>
        </HStack>
        {sortedMessages.length > 0 && (
          <VStack
            gap="medium"
            data-testid={`${name.toLowerCase()}-message-content`}
          >
            {sortedMessages.map((message, index, { length }) => {
              const toolReturnMessage =
                message.message_type === 'tool_call_message' ||
                (message.message_type === 'approval_request_message' &&
                  'tool_call_id' in message.tool_call)
                  ? toolReturnMessages[message.tool_call.tool_call_id || '']
                  : undefined;

              const messageToSet = message;

              if (
                message.message_type === 'tool_call_message' ||
                message.message_type === 'approval_request_message'
              ) {
                // set the stepId of the tool_call_message to the tool_return_message's stepId if it exists
                if (toolReturnMessage && toolReturnMessage.step_id) {
                  messageToSet.step_id = toolReturnMessage.step_id;
                }
              }

              return (
                <Message
                  isLastMessage={index === length - 1}
                  key={`${message.id}_${index}`}
                  message={messageToSet}
                  toolReturnMessage={toolReturnMessage}
                />
              );
            })}
          </VStack>
        )}
      </VStack>
    </MessageGroupContextProvider>
  );
}

interface MessageGroupsProps {
  messages: ListMessagesResponse;
  hasNextPage?: boolean;
  mode: MessagesDisplayMode;
  isSendingMessage?: boolean;
}

export const MessageGroups = memo(
  function MessageGroups(props: MessageGroupsProps) {
    const { messages, mode, isSendingMessage, hasNextPage = false } = props;

    const t = useTranslations('components/Messages');

    const messageGroups = useGroupedMessages({
      messages,
    });

    return (
      <>
        {messageGroups.map((group, index) => (
          <MessageGroup
            isSendingMessage={
              index === messageGroups.length - 1 && isSendingMessage
            }
            mode={mode}
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
