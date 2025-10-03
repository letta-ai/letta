import { useCallback, useEffect, useRef } from 'react';
import { deepEqual } from 'fast-equals';
import type { RunResponse, RunResponseMessage } from '../../../../../../hooks';

interface AgentMessengerMessagesOptions {
  runResponses?: RunResponse[];
  isSendingMessage?: boolean;
  isFetchingOlderRuns?: boolean;
  fetchOlderRuns?: () => void;
}

export function useManageAgentMessengerMessages(
  options: AgentMessengerMessagesOptions,
) {
  const {
    runResponses,
    isSendingMessage,
    fetchOlderRuns,
    isFetchingOlderRuns,
  } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchNextPageLock = useRef(false);

  /* Scroll lock prevents scrolling, this is if the user tries to scroll up while new messages are being sent. */
  const scrollLock = useRef(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight + 1000;

        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight + 1000;
          }

          fetchNextPageLock.current = true;
          scrollLock.current = false;
        }, 250);
      }
    });
  }, []);

  // if we're fetching older runs, lock the older page fetch
  useEffect(() => {
    if (isFetchingOlderRuns) {
      fetchNextPageLock.current = false;
    }
  }, [isFetchingOlderRuns]);

  const runCountRef = useRef(0);

  // if the run count changes, we should maintain scroll position
  useEffect(() => {
    if (!runResponses || runResponses.length === 0) {
      return;
    }

    if (runResponses.length > runCountRef.current) {
      // When new runs are added (older runs loaded), maintain scroll position
      // by scrolling to the first run that was already loaded
      const previousFirstRun = runResponses[runResponses.length - runCountRef.current];

      if (previousFirstRun && previousFirstRun.run.id) {
        const runId = `run_${previousFirstRun.run.id}`;
        const element = document.getElementById(runId);

        if (element) {
          // Scroll to maintain position
          const elementTop = element.offsetTop;
          if (scrollRef.current) {
            scrollRef.current.scrollTop = elementTop - 43;
          }
        }
      }
    }

    fetchNextPageLock.current = true;
    runCountRef.current = runResponses.length;
  }, [runResponses]);

  const lastAutoFetch = useRef<number>(0)

  // if the user is near the top of the page, fetch older runs
  useEffect(() => {
    if (
      !scrollRef.current ||
      !runResponses ||
      runResponses.length === 0
    ) {
      return;
    }

    const scrollElement = scrollRef.current;

    // if the user is near the top of the page, fetch older runs
    // only if the user has not scrolled to the bottom yet
    function scrollHandler() {
      // dont auto load if we havent scrolled to the bottom yet
      if (!fetchNextPageLock.current) {
        return;
      }

      if (scrollElement.scrollTop < 100) {
        // if the last autofetch was less than 1.5 seconds ago, wait
        if (Date.now() - lastAutoFetch.current < 1500) {
          return;
        }

        fetchOlderRuns?.();
        lastAutoFetch.current = Date.now();
      }
    }

    scrollElement.addEventListener('scroll', scrollHandler);

    return () => {
      scrollElement.removeEventListener('scroll', scrollHandler);
    };
  }, [fetchOlderRuns, runResponses]);

  // on mode change or if isSendingMessage starts, scroll to bottom
  useEffect(() => {
    // release scroll lock
    if (!scrollLock.current || isSendingMessage) {
      scrollToBottom();
    }

    scrollLock.current = false;
    fetchNextPageLock.current = false;
  }, [isSendingMessage, scrollToBottom]);

  const intialLoadLock = useRef(true);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (runResponses && runResponses.length > 0) {
      if (intialLoadLock.current) {
        intialLoadLock.current = false;
        fetchNextPageLock.current = true;

        scrollToBottom();
        return;
      }
    }
  }, [runResponses, scrollToBottom]);

  // set up scroll lock ref
  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    // check if user is scrolling in viewport, and its the user not the program
    // basically if they're scrolling up, enable scroll lock, if they're scrolling down, disable it
    function scrollHandler(e: WheelEvent) {
      if (!scrollRef.current) {
        return;
      }

      // if user is scrolling up we should enable scroll lock
      if (e.deltaY < 100) {
        scrollLock.current = true;
        return;
      }

      // if user is near the bottom, disable scroll lock
      if (
        scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight <
        300
      ) {
        scrollLock.current = false;
      }
    }

    const currentScrollRef = scrollRef.current;
    currentScrollRef.addEventListener('wheel', scrollHandler);

    return () => {
      currentScrollRef.removeEventListener('wheel', scrollHandler);
    };
  }, [scrollRef]);

  // if a new message is added to the most recent run, scroll to bottom
  const lastMessage = useRef<RunResponseMessage | null>(null);
  useEffect(() => {
    if (
      !runResponses ||
      runResponses.length === 0
    ) {
      return;
    }

    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.style.scrollBehavior = 'smooth';

    // Get the most recent run (first in array)
    const mostRecentRun = runResponses[0];
    const messages = mostRecentRun?.messages || [];
    const newLastMessage = messages[messages.length - 1] || null;


    // Scroll to bottom when a new non-user message is added
    // User messages are handled in the isSendingMessage useEffect
    if (
      newLastMessage &&
      // newLastMessage.message_type !== 'user_message' &&
      !deepEqual(newLastMessage, lastMessage.current)
    ) {
      if (scrollLock.current) {
        return;
      }



      lastMessage.current = newLastMessage;
      scrollToBottom();
    }

    scrollRef.current.style.scrollBehavior = 'auto';
  }, [runResponses, scrollToBottom]);

  return {
    scrollRef,
  };
}
