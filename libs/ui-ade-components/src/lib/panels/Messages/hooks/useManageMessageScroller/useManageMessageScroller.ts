import { useCallback, useEffect, useRef } from 'react';
import { useMessagesContext } from '../useMessagesContext/useMessagesContext';
import type { InfiniteData } from '@tanstack/query-core';
import type { LettaMessageUnion, ListMessagesResponse } from '@letta-cloud/sdk-core';
import { deepEqual } from 'fast-equals';

interface ManageMessageScrollerOptions {
  messagesData?: InfiniteData<ListMessagesResponse>;
  isSendingMessage?: boolean;
  isFetchingOlderPage?: boolean;
  fetchOlderPage?: () => void;
}

export function useManageMessageScroller(
  options: ManageMessageScrollerOptions,
) {
  const {
    messagesData,
    isSendingMessage,
    fetchOlderPage,
    isFetchingOlderPage,
  } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchNextPageLock = useRef(false);

  /* Scroll lock prevents scrolling, this is if the user tries to scroll up while new messages are being sent. */
  const scrollLock = useRef(false);

  // on mount, or mode change, scroll down
  const { mode } = useMessagesContext();

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight + 1000;

        setTimeout(() => {
          fetchNextPageLock.current = true;
        }, 250);
      }
    });
  }, []);

  // if we're fetching an older page, lock the older page fetch
  useEffect(() => {
    if (isFetchingOlderPage) {
      fetchNextPageLock.current = false;
    }
  }, [isFetchingOlderPage]);

  const pageCountRef = useRef(1);

  // if the page count changes, we should scroll to the last message of the new page
  useEffect(() => {
    if (!messagesData || messagesData.pages.length === 0) {
      return;
    }

    if (messagesData.pages.length > pageCountRef.current) {
      // scroll to bottom of the previous last page's first message
      // get the messageId + message_type, this is the html element id we want to scroll to
      // we should use reverse find, because in non-debug mode, we need to look for a message_type that isnt tool_return_message
      const lastPageMessages =
        messagesData.pages[messagesData.pages.length - 2] || [];

      const lastMessage = lastPageMessages.find((message) => {
        if (mode === 'interactive') {
          return message.message_type !== 'tool_return_message';
        }
        if (mode === 'simple') {
          // message is a user or assistant
          return (
            message.message_type === 'user_message' ||
            (message.message_type === 'tool_call_message' &&
              message.tool_call.name === 'send_message')
          );
        }

        return true;
      });

      if (lastMessage) {
        const messageId = `message_${lastMessage.id}_${lastMessage.message_type}`;

        const element =
          document.getElementById(messageId)?.parentElement?.parentElement;
        if (element) {
          element.scrollIntoView({ behavior: 'instant', block: 'start' });
          // and add 35px
          if (scrollRef.current) {
            scrollRef.current.scrollTop -= 43;
          }
        }
      }
    }

    fetchNextPageLock.current = true;
    pageCountRef.current = messagesData.pages.length;
  }, [messagesData, scrollToBottom, mode]);

  // if the user is near the top of the page, as long as the page is larger than the viewport, fetch older messages
  useEffect(() => {
    if (
      !scrollRef.current ||
      !messagesData ||
      messagesData.pages.length === 0
    ) {
      return;
    }

    const scrollElement = scrollRef.current;

    // if the user is near the top of the page, fetch older messages
    // only if the user has not scrolled to the bottom yet
    function scrollHandler() {
      // dont auto load if we havent scrolled to the bottom yet
      if (!fetchNextPageLock.current) {
        return;
      }

      if (scrollElement.scrollTop < 100) {
        fetchOlderPage?.();
      }
    }

    scrollElement.addEventListener('scroll', scrollHandler);

    return () => {
      scrollElement.removeEventListener('scroll', scrollHandler);
    };
  }, [fetchOlderPage, messagesData]);

  // on mode change or if isSendingMessage starts, scroll to bottom
  useEffect(() => {
    // release scroll lock
    scrollLock.current = false;

    fetchNextPageLock.current = false;
    scrollToBottom();
  }, [mode, isSendingMessage, scrollToBottom]);

  // set up scroll lock ref
  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    // check if user is scrolling in viewport
    function scrollHandler() {
      scrollLock.current = true;
    }

    const currentScrollRef = scrollRef.current;
    currentScrollRef.addEventListener('scroll', scrollHandler);

    return () => {
      currentScrollRef.removeEventListener('scroll', scrollHandler);
    };
  }, [scrollRef]);

  // on the first page, if a new message is added or the last message is updated, scroll to bottom
  const lastMessage = useRef<LettaMessageUnion | null>(null);
  useEffect(() => {
    if (
      !messagesData ||
      !messagesData.pages ||
      messagesData.pages.length === 0
    ) {
      return;
    }

    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.style.scrollBehavior = 'smooth';

    const messages = messagesData.pages[0] || [];
    const newLastMessage = messages[messages.length - 1] || null;

    // why not user message?  because this should be handled in the isSendingMessage useEffect, also this contains the scroll lock code
    // we always want to scroll to the bottom of the initial agent message
    if (
      newLastMessage &&
      newLastMessage.message_type !== 'user_message' &&
      !deepEqual(newLastMessage, lastMessage.current)
    ) {
      if (scrollLock.current) {
        return;
      }

      lastMessage.current = newLastMessage;
      scrollToBottom();
    }

    scrollRef.current.style.scrollBehavior = 'auto';
  }, [messagesData, scrollToBottom]);

  return {
    scrollRef,
  };
}
