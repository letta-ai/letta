'use client';
import { useParams } from 'next/navigation';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import {
  ChatInput,
  type ChatInputRef,
  HStack,
  Link,
  Logo,
  PersonIcon,
  Typography,
  VStack,
} from '@letta-cloud/component-library';
import { Messages } from '@letta-cloud/shared-ade-components';
import React, { useRef } from 'react';
import { useSendMessage } from '@letta-cloud/shared-ade-components';
import { useTranslations } from '@letta-cloud/translations';
import { ProfilePopover } from '$web/client/components/DashboardLikeLayout/DashboardNavigation/DashboardNavigation';

function useChatId() {
  const params = useParams<{ chatId: string }>();

  return params.chatId;
}

function useAgent() {
  const chatId = useChatId();
  const { data } = webApi.sharedAgentChats.getSharedAgentFromChatId.useQuery({
    queryKey: webApiQueryKeys.sharedAgentChats.getSharedAgentFromChatId(chatId),
    queryData: {
      params: {
        chatId,
      },
    },
  });

  return data?.body;
}

export default function ChatPage() {
  const agent = useAgent();
  const agentId = agent?.agentId || '';
  const ref = useRef<ChatInputRef | null>(null);
  const t = useTranslations('chat');

  const {
    sendMessage,
    isError: hasFailedToSendMessage,
    isPending,
  } = useSendMessage(agentId || '', {
    onFailedToSendMessage: (message) => {
      ref.current?.setChatMessage(message);
    },
  });

  if (!agentId) {
    return null;
  }

  return (
    <div className="relative w-[100dvw] h-[100dvh] flex flex-col">
      <HStack
        color="background-grey"
        align="center"
        paddingX
        paddingY="small"
        justify="spaceBetween"
        position="relative"
      >
        <Link href="/">
          <Logo withText size="small" />
        </Link>
        <div className="absolute w-full left-0 top-0 pointer-events-none flex h-full justify-center items-center">
          <div className="pointer-events-auto">
            <Typography bold variant="body2">
              {agent?.agentName || ''}
            </Typography>
          </div>
        </div>
        <HStack>
          <ProfilePopover />
        </HStack>
      </HStack>
      <div className="max-w-[840px] mx-auto px-4 pt-4 w-full flex-1">
        <VStack gap="large" fullHeight>
          <VStack collapseHeight position="relative">
            <Messages
              mode="interactive"
              isPanelActive
              isSendingMessage={isPending}
              agentId={agentId}
            />
          </VStack>
          <ChatInput
            disabled={!agentId}
            defaultRole="user"
            roles={[
              {
                value: 'user',
                label: t('role.user'),
                icon: <PersonIcon />,
                color: {
                  background: 'hsl(var(--user-color))',
                  text: 'hsl(var(--user-color-content))',
                },
              },
            ]}
            ref={ref}
            hasFailedToSendMessageText={
              hasFailedToSendMessage ? t('hasFailedToSendMessage') : ''
            }
            sendingMessageText={t('sendingMessage')}
            onSendMessage={(role: string, content: string) => {
              sendMessage({ role, content });
            }}
            isSendingMessage={isPending}
          />
        </VStack>
      </div>
    </div>
  );
}
