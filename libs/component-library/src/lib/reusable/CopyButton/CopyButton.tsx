'use client';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../core/Button/Button';
import { CheckIcon, ClipboardIcon } from '../../icons';

interface CopyButtonProps {
  textToCopy: string;
  copyButtonText?: string;
  size?: 'default' | 'small';
}

export function CopyButton(props: CopyButtonProps) {
  const { textToCopy, size = 'default', copyButtonText = 'Copy' } = props;
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

  return (
    <Button
      size={size}
      color="tertiary"
      preIcon={isCopied ? <CheckIcon /> : <ClipboardIcon />}
      label={isCopied ? 'Copied' : copyButtonText}
      onClick={() => {
        void copyToClipboard();
      }}
    />
  );
}
