import {
  Avatar,
  Button,
  Frame,
  HStack,
  Panel,
  PanelBar,
  PanelHeader,
  Typography,
  VStack,
} from '@letta-web/component-library';
import React, { useEffect, useMemo, useRef } from 'react';
import { useAgentsServiceListAgentMessages } from '@letta-web/letta-agents-api';
import { useCurrentAgentId } from '../hooks';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';

interface MessageProps {
  id: string;
  content: string;
  timestamp: string;
}

function Message({ content }: MessageProps) {
  return (
    <HStack fullWidth>
      <Typography>{content}</Typography>
    </HStack>
  );
}

interface MessageGroupType {
  name: string;
  id: string;
  messages: MessageProps[];
}

function MessageGroup({ name, messages }: MessageGroupType) {
  return (
    <HStack>
      <Avatar name={name} />
      <VStack fullWidth gap="small">
        <Typography bold>{name}</Typography>
        {messages.map((message) => (
          <Message key={message.id} {...message} />
        ))}
      </VStack>
    </HStack>
  );
}

function Messages() {
  const ref = useRef<HTMLDivElement>(null);

  const currentAgentId = useCurrentAgentId();
  const { data } = useAgentsServiceListAgentMessages({
    agentId: currentAgentId,
  });

  const messageGroups = useMemo(() => {
    const preMessages = (data || []).map((message) => ({
      id: message.id,
      text: message.text,
      role: message.role,
      name: message.role === 'user' ? 'User' : 'Ultimate Agent',
      created_at: message.created_at,
    }));

    // group messages by name

    const groupedMessages: MessageGroupType[] = [];

    preMessages.forEach((message, index) => {
      const lastGroup = groupedMessages[groupedMessages.length - 1];
      const nextMessage = {
        id: message.id || '',
        content: message.text || '',
        timestamp: message.created_at || '',
      };

      if (index !== 0 && lastGroup.name === message.name) {
        lastGroup.messages.push(nextMessage);
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
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [messageGroups]);

  return (
    <VStack ref={ref} fullWidth collapseHeight overflowY="auto" padding="large">
      {messageGroups.map((messageGroup) => (
        <MessageGroup key={messageGroup.id} {...messageGroup} />
      ))}
    </VStack>
  );
}

function ChatInput() {
  return (
    <Frame paddingX="medium" paddingBottom>
      <VStack rounded border fullWidth padding="large" borderTop>
        <textarea className="w-full" rows={3} />
        <HStack justify="spaceBetween">
          <div />
          <Button color="secondary" label="Send" />
        </HStack>
      </VStack>
    </Frame>
  );
}

function Chatroom() {
  return (
    <VStack collapseHeight gap={false} fullWidth>
      <PanelBar>
        <HStack
          fullWidth
          paddingX="small"
          align="center"
          justify="spaceBetween"
        >
          <Typography>Ultimate Agent</Typography>
          <HStack>
            <Button color="tertiary" size="small" label="Options" />
          </HStack>
        </HStack>
      </PanelBar>
      <Messages />
      <ChatInput />
    </VStack>
  );
}

export function AgentSimulator() {
  return (
    <Panel
      id={['chat-simulator']}
      trigger={<ADENavigationItem title="Chat Simulator" />}
    >
      <PanelHeader title="Simulator" />
      <Chatroom />
    </Panel>
  );
}
