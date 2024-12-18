'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../core/Toaster/Toaster';
import { useTranslations } from 'next-intl';

interface UseCopyToClipboardArgs {
  textToCopy: string;
}

export function useCopyToClipboard(args: UseCopyToClipboardArgs) {
  const { textToCopy } = args;
  const [isCopied, setIsCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslations('component-library/hooks/useCopyToClipboard');

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      toast.success(t('copied'));

      timer.current = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (_) {
      alert('Failed to copy to clipboard');
    }
  }, [t, textToCopy]);

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
