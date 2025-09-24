'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  VStack,
  LoadingEmptyStatusComponent,
  Spinner,
  HStack,
  Typography,
} from '@letta-cloud/ui-component-library';
import type { LettaMessageUnion } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { cn } from '@letta-cloud/ui-styles';
import './Messages.scss';
import type { MessagesDisplayMode } from './types';
import { MessageGroups } from './MessageGroups/MessageGroups';
import { MessagesProvider } from './hooks/useMessagesContext/useMessagesContext';
import { useManageMessageScroller } from './hooks/useManageMessageScroller/useManageMessageScroller';
import {
  removeDuplicateMessages,
  useAgentMessages,
} from '../../../hooks/useAgentMessages/useAgentMessages';

interface MessagesProps {
  isSendingMessage: boolean;
  agentId: string;
  mode: MessagesDisplayMode;
  isPanelActive?: boolean;
  renderAgentsLink?: boolean;
  injectSpaceForHeader?: boolean;
  disableInteractivity?: boolean;
}

interface LastMessageReceived {
  id: string;
  date: number;
}

export function Messages(props: MessagesProps) {
  const {
    disableInteractivity,
    isSendingMessage,
    injectSpaceForHeader,
    mode,
    agentId,
  } = props;

  const t = useTranslations('components/Messages');
  const [lastMessageReceived, setLastMessageReceived] =
    useState<LastMessageReceived | null>(null);

  const refetchInterval = useMemo(() => {
    if (isSendingMessage) {
      return false;
    }


    return 5000;
  }, [isSendingMessage]);

  const { data, hasNextPage, fetchNextPage, isFetching, isFetchingNextPage } =
    useAgentMessages({
      agentId,
      refetchInterval,
      isEnabled: !isSendingMessage,
    });

  useEffect(() => {
    if (!data?.pages || data.pages.length === 0) {
      return;
    }

    // most recent message is the first message in the first page
    const mostRecentMessage = data.pages[0][0];

    if (!mostRecentMessage || !('date' in mostRecentMessage)) {
      return;
    }

    const messageDate = new Date(mostRecentMessage.date).getTime();

    if (mostRecentMessage.id !== lastMessageReceived?.id) {
      setLastMessageReceived((prev) => {
        // Only update if the message is actually different
        if (prev?.id === mostRecentMessage.id && prev?.date === messageDate) {
          return prev;
        }
        return {
          id: mostRecentMessage.id,
          date: messageDate,
        };
      });
    }
  }, [data?.pages, lastMessageReceived?.id]);

  const shouldRenderMessage = useCallback(
    function shouldRenderMessage(message: LettaMessageUnion) {
      switch (mode) {
        case 'simple': {
          if (message.message_type === 'reasoning_message') {
            return false;
          }
        }
        case 'interactive': {
          if (!message.message_type) {
            return false;
          }

          if (message.message_type === 'tool_call_message') {
            return !!message.tool_call.name;
          }

          if (['system_message'].includes(message.message_type)) {
            return false;
          }

          if (message.message_type === 'user_message') {
            // we should hide user_messages with `"type": "login" json (do not parse)
            if (typeof message.content === 'string') {
              if (message.content?.includes('"type": "login"')) {
                return false;
              }

              // hides if type is system_alert
              if (message.content?.includes('"type": "system_alert"')) {
                return false;
              }

              if (message.content?.includes('"type": "heartbeat"')) {
                return false;
              }
            }

            return true;
          }

          return true;
        }
        case 'debug':
          return true;
      }
    },
    [mode],
  );

  // Memoize the raw messages array to prevent unnecessary recalculations
  const messages = useMemo(() => {
    if (!data) {
      return [];
    }

    if (!Array.isArray(data.pages[0])) {
      return [];
    }

    const messages = data.pages.flat();

    let res = removeDuplicateMessages(messages).filter(shouldRenderMessage).toSorted((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    const lastMessage = res[res.length - 1];

    if (isSendingMessage || lastMessage?.message_type === 'user_message') {
      res = [
        ...res,
        {
          id: 'sending-message-placeholder',
          content: '',
          message_type: 'assistant_message',
          date: new Date().toISOString(),
        }
      ]
    }

    return res;
  }, [data, isSendingMessage, shouldRenderMessage]);

  const { scrollRef } = useManageMessageScroller({
    isSendingMessage,
    mode,
    messagesData: data,
    fetchOlderPage: () => {
      if (isFetching || !hasNextPage) {
        return;
      }
      fetchNextPage();
    },
  });

  return (
    <MessagesProvider disableInteractivity={disableInteractivity ?? false}>
      <VStack collapseHeight flex overflow="hidden">
        <VStack
          ref={scrollRef}
          data-testid="messages-list"
          fullWidth
          fullHeight
          overflowY="auto"
          className={cn('relative')}
          gap="small"
          padding="small"
        >
          {injectSpaceForHeader && (
            <div
              className="w-full justify-center flex"
              style={{ minHeight: 28 }}
            >
              <HStack
                style={{
                  width: 28,
                }}
                className={cn(
                  isFetchingNextPage ? 'opacity-100' : 'opacity-0',
                  'transition-opacity duration-500',
                )}
                fullHeight
                justify="center"
                border
                paddingX="small"
                paddingY="xxsmall"
                align="center"
                color="background-grey2"
              >
                <Spinner size="small" />
              </HStack>
              {hasNextPage && !isFetchingNextPage && (
                <HStack
                  style={{
                    marginRight: 10,
                  }}
                  className={cn(
                    hasNextPage && !isFetchingNextPage
                      ? 'opacity-100'
                      : 'opacity-0',
                    'transition-opacity duration-500',
                  )}
                  fullHeight
                  justify="center"
                  as="button"
                  onClick={() => {
                    fetchNextPage();
                  }}
                  border
                  paddingX="small"
                  paddingY="xxsmall"
                  align="center"
                  color="background-grey2"
                >
                  <Typography variant="body3" bold>
                    {t('loadMore')}
                  </Typography>
                </HStack>
              )}
            </div>
          )}
          <MessageGroups
            mode={mode}
            messages={messages}
            isSendingMessage={isSendingMessage}
            hasNextPage={hasNextPage}
          />
        </VStack>
        <div
          className={cn(
            'absolute w-full overflow-hidden h-full top-0 left-0 items-center justify-center transition-opacity duration-500',
            messages.length > 0 ? 'opacity-0 pointer-events-none' : '',
          )}
        >
          <LoadingEmptyStatusComponent
            isLoading={!data}
            emptyMessage={
              disableInteractivity ? t('noMessagesPreviewTab') : t('noMessages')
            }
            loaderFillColor="background-grey"
            loaderVariant="spinner"
          />
        </div>
      </VStack>
    </MessagesProvider>
  );
}
