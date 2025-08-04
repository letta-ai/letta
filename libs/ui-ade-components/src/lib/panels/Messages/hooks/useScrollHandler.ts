import { useCallback, useRef } from 'react';

interface UseScrollHandlerProps {
  ref: React.RefObject<HTMLDivElement | null>;
  hasNextPage: boolean;
  isFetching: boolean;
  fetchNextPage: () => Promise<any>;
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

  const handleScroll = useCallback(() => {
    if (
      !ref.current ||
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
    cleanup,
  };
}
