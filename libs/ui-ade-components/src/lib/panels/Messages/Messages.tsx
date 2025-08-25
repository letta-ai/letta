'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  VStack,
  LoadingEmptyStatusComponent,
  Spinner,
  HStack,
} from '@letta-cloud/ui-component-library';
import type { LettaMessageUnion } from '@letta-cloud/sdk-core';
import {
  type ListMessagesResponse,
  UseAgentsServiceListMessagesKeyFn,
} from '@letta-cloud/sdk-core';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { useTranslations } from '@letta-cloud/translations';
import { useGetMessagesWorker } from './useGetMessagesWorker/useGetMessagesWorker';
import { useCurrentDevelopmentServerConfig } from '@letta-cloud/utils-client';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { cn } from '@letta-cloud/ui-styles';
import './Messages.scss';
import type { MessagesDisplayMode } from './types';
import { MessageGroups } from './MessageGroups/MessageGroups';
import { MessagesProvider } from './hooks/useMessagesContext/useMessagesContext';
import { useManageMessageScroller } from './hooks/useManageMessageScroller/useManageMessageScroller';

const MESSAGE_LIMIT = 10;

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

// remove duplicate messages based on id+message_type
function removeDuplicateMessages(
  messages: ListMessagesResponse,
): ListMessagesResponse {
  const messageExistingMap = new Set<string>();
  return messages.filter((message) => {
    const uid = `${message.id}-${message.message_type}`;
    if (messageExistingMap.has(uid)) {
      return false;
    }
    messageExistingMap.add(uid);
    return true;
  });
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

  const developmentServerConfig = useCurrentDevelopmentServerConfig();
  const { getMessages } = useGetMessagesWorker();

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

  const queryClient = useQueryClient();
  const { data: includeErr = false } = useFeatureFlag('SHOW_ERRORED_MESSAGES');

  const { data, hasNextPage, fetchNextPage, isFetching } = useInfiniteQuery<
    LettaMessageUnion[],
    Error,
    InfiniteData<ListMessagesResponse>,
    unknown[],
    { before?: string }
  >({
    refetchInterval,
    queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
    queryFn: async (query) => {
      const res = (await getMessages({
        url: developmentServerConfig?.url,
        headers: {
          'X-SOURCE-CLIENT': window.location.pathname,
          ...(developmentServerConfig?.password
            ? {
                Authorization: `Bearer ${developmentServerConfig.password}`,
                'X-BARE-PASSWORD': `password ${developmentServerConfig.password}`,
              }
            : {}),
        },
        agentId,
        limit: MESSAGE_LIMIT,
        includeErr: includeErr,
        ...(query.pageParam.before ? { cursor: query.pageParam.before } : {}),
      })) as unknown as ListMessagesResponse;

      if (query.pageParam.before) {
        return res;
      }

      const data = queryClient.getQueriesData<
        InfiniteData<ListMessagesResponse>
      >({
        queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
      });

      const firstPage = data[0]?.[1]?.pages[0] || [];

      return removeDuplicateMessages([
        ...(firstPage as LettaMessageUnion[]),
        ...(Array.isArray(res) ? res : []),
      ]) as ListMessagesResponse;
    },
    getNextPageParam: (lastPage) => {
      if (!Array.isArray(lastPage)) {
        return undefined;
      }

      if (lastPage.length < MESSAGE_LIMIT) {
        return undefined;
      }

      return {
        before: lastPage.toSorted(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        )[0].id,
      };
    },
    enabled: !isSendingMessage && !!agentId,
    initialPageParam: { before: '' },
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

  // Memoize the raw messages array to prevent unnecessary recalculations
  const messages = useMemo(() => {
    if (!data) {
      return [];
    }

    if (!Array.isArray(data.pages[0])) {
      return [];
    }

    const messages = data.pages.flat();

    return removeDuplicateMessages(messages);
  }, [data]);

  const { scrollRef } = useManageMessageScroller({
    isSendingMessage,
    messagesData: data,
    fetchOlderPage: () => {
      if (isFetching || !hasNextPage) {
        return;
      }
      fetchNextPage();
    },
  });

  return (
    <MessagesProvider
      disableInteractivity={disableInteractivity ?? false}
      mode={mode}
    >
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
              className="w-full items-center justify-end flex"
              style={{ minHeight: 28 }}
            >
              <HStack
                style={{
                  width: 28
                }}
                className={cn(
                  isFetching ? 'opacity-100' : 'opacity-0',
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
              <div style={{ width: 209 }} />
            </div>
          )}
          <MessageGroups messages={messages} hasNextPage={hasNextPage} />
        </VStack>
        <div
          className={cn(
            'absolute w-full overflow-hidden h-full top-0 left-0 items-center justify-center transition-opacity duration-500',
            data ? 'opacity-0 pointer-events-none' : '',
          )}
        >
          <LoadingEmptyStatusComponent
            isLoading={!data}
            emptyMessage={t('noMessages')}
            loaderFillColor="background-grey"
            hideText
            loaderVariant="spinner"
          />
        </div>
      </VStack>
    </MessagesProvider>
  );
}
