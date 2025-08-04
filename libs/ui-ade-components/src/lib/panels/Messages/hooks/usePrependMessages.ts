import * as React from 'react';

export function usePrependMessages(
  _scrollerRef: React.RefObject<HTMLDivElement | null>,
) {
  const AT_TOP_TOLERANCE = 80;

  // new: explicit flag
  const shouldPreserveRef = React.useRef(false);

  const anchorTopRef = React.useRef<number | null>(null);
  const anchorElRef = React.useRef<HTMLElement | null>(null);
  const prevHeightRef = React.useRef<number | null>(null);

  const setPreserveNextPrepend = React.useCallback((value: boolean) => {
    shouldPreserveRef.current = value;
  }, []);

  const measureBefore = React.useCallback((scroller: HTMLDivElement) => {
    if (!shouldPreserveRef.current) {
      return;
    }

    // Always record height for fallback
    prevHeightRef.current = scroller.scrollHeight;

    // If we're near the top, capture an anchor for pixel-perfect correction
    const atTop = scroller.scrollTop <= AT_TOP_TOLERANCE;
    if (atTop) {
      const anchor = scroller.querySelector<HTMLElement>(
        '[data-anchor="old-first"]',
      );
      if (anchor) {
        anchorElRef.current = anchor;
        anchorTopRef.current = anchor.getBoundingClientRect().top;
      }
    }

    // Avoid the browser's own anchoring fighting our correction
    scroller.style.setProperty('overflow-anchor', 'none');
  }, []);

  const correctAfter = React.useCallback((scroller: HTMLDivElement) => {
    if (!shouldPreserveRef.current) {
      scroller.style.removeProperty('overflow-anchor');
      return;
    }

    const prev = scroller.style.scrollBehavior;
    scroller.style.scrollBehavior = 'auto';

    if (anchorElRef.current && anchorTopRef.current != null) {
      // Prefer precise anchor correction when we had one
      const topAfter = anchorElRef.current.getBoundingClientRect().top;
      const scrollAdjustment = topAfter - anchorTopRef.current;
      scroller.scrollTop += scrollAdjustment;
    } else if (prevHeightRef.current != null) {
      // Otherwise, fallback to height delta (works anywhere in the list)
      const h1 = scroller.scrollHeight;
      const heightDelta = h1 - prevHeightRef.current;
      scroller.scrollTop += heightDelta;
    }

    scroller.style.scrollBehavior = prev || '';
    scroller.style.removeProperty('overflow-anchor');

    // cleanup for next cycle
    shouldPreserveRef.current = false;
    anchorElRef.current = null;
    anchorTopRef.current = null;
    prevHeightRef.current = null;
  }, []);

  return { setPreserveNextPrepend, measureBefore, correctAfter };
}
