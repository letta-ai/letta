import { useCallback, useRef, useEffect } from 'react';

interface UseScrollHandlerProps {
  ref: React.RefObject<HTMLDivElement | null>;
  hasNextPage: boolean;
  isFetching: boolean;
  fetchNextPage: () => Promise<unknown>;
  measureBefore: (scroller: HTMLDivElement) => void;
  setPreserveNextPrepend: (value: boolean) => void;
}

export function useScrollHandler({
  ref,
  hasNextPage,
  isFetching,
  fetchNextPage,
  measureBefore,
  setPreserveNextPrepend,
}: UseScrollHandlerProps) {
  const isAutoLoading = useRef(false);
  const hasReachedEnd = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll state - disabled by default, only enabled when user sends message
  const isAutoScrollEnabled = useRef(false);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!ref.current) return;

    // Only handle pagination if conditions are met
    if (
      !hasNextPage ||
      isAutoLoading.current ||
      isFetching ||
      hasReachedEnd.current
    ) {
      return;
    }

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce scroll events
    scrollTimeoutRef.current = setTimeout(() => {
      if (!ref.current) return;

      const scrollTop = ref.current.scrollTop;
      const threshold = 2000; // Starts loading when near the top

      if (scrollTop <= threshold) {
        isAutoLoading.current = true;

        // tell the hook we expect to prepend and want to preserve view
        setPreserveNextPrepend(true);
        measureBefore(ref.current);

        void fetchNextPage().finally(() => {
          isAutoLoading.current = false;
        });
      }
    }, 50); // Much faster debounce for smoother response
  }, [
    ref,
    hasNextPage,
    fetchNextPage,
    isFetching,
    measureBefore,
    setPreserveNextPrepend,
  ]);

  // Futore work:
  // Re-enable auto-scroll when user scrolls to the bottom
  // Tricky, because of delicate balance between auto-scroll, user scroll, and positioning detection from bottom

  // Setup trackpad scroll detection and content change detection
  useEffect(() => {
    if (!ref.current) return;

    function handleWheel (_event: WheelEvent) {
      // Disable auto-scroll immediately on any wheel event
      isAutoScrollEnabled.current = false;
    };

    // Setup MutationObserver to detect content changes (for streaming)
    const observer = new MutationObserver((mutations) => {
      // Check if any mutations added nodes (new content)
      const hasNewContent = mutations.some(mutation =>
        mutation.type === 'childList' && mutation.addedNodes.length > 0
      );

      if (hasNewContent && isAutoScrollEnabled.current) {
        // Check again immediately before scrolling to prevent race conditions
        if (isAutoScrollEnabled.current && ref.current) {
          ref.current.scrollTo({
            top: ref.current.scrollHeight,
            behavior: 'auto'
          });
        }
      }
    });

    const container = ref.current;
    container.addEventListener('wheel', handleWheel, { passive: true });

    // Observe the scroll container for DOM changes
    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      observer.disconnect();
    };
  }, [ref]);

  // Enable auto-scroll when user sends a message
  const enableAutoScroll = useCallback(() => {
    isAutoScrollEnabled.current = true;
  }, []);

  // Force scroll to bottom (ignores auto-scroll state)
  const forceScrollToBottom = useCallback(() => {
    if (!ref.current) return;

    ref.current.scrollTo({
      top: ref.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [ref]);

  const resetFlags = useCallback(() => {
    hasReachedEnd.current = false;
  }, []);

  const setHasReachedEnd = useCallback((value: boolean) => {
    hasReachedEnd.current = value;
  }, []);

  const getIsAutoLoading = useCallback(() => {
    return isAutoLoading.current;
  }, []);

  const getHasReachedEnd = useCallback(() => {
    return hasReachedEnd.current;
  }, []);

  const getIsAutoScrollEnabled = useCallback(() => {
    return isAutoScrollEnabled.current;
  }, []);

  const cleanup = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  }, []);

  return {
    handleScroll,
    resetFlags,
    setHasReachedEnd,
    getIsAutoLoading,
    getHasReachedEnd,
    getIsAutoScrollEnabled,
    enableAutoScroll,
    forceScrollToBottom,
    cleanup,
  };
}
