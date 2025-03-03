'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../core/Toaster/Toaster';
import { useTranslations } from '@letta-cloud/translations';

interface UseCopyToClipboardArgs {
  textToCopy: string;
  copySuccessMessage?: string;
}

export function useCopyToClipboard(args: UseCopyToClipboardArgs) {
  const { textToCopy, copySuccessMessage } = args;
  const [isCopied, setIsCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslations('ui-component-library/hooks/useCopyToClipboard');

  const copyToClipboard = useCallback(
    async (textOverride?: string) => {
      try {
        await navigator.clipboard.writeText(textOverride || textToCopy);
        setIsCopied(true);
        toast.success(copySuccessMessage || t('copied'));

        timer.current = setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      } catch (_) {
        alert('Failed to copy to clipboard');
      }
    },
    [t, textToCopy, copySuccessMessage],
  );

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
