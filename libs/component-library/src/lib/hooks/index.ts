'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCopyToClipboardArgs {
  textToCopy: string;
}

export function useCopyToClipboard(args: UseCopyToClipboardArgs) {
  const { textToCopy } = args;
  const [isCopied, setIsCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      timer.current = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (_) {
      alert('Failed to copy to clipboard');
    }
  }, [textToCopy]);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  return {
    isCopied,
    copyToClipboard,
  };
}
