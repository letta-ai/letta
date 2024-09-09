'use client';
import * as React from 'react';
import { Button } from '../../core/Button/Button';
import { CheckIcon, ClipboardIcon } from '../../icons';
import { useCopyToClipboard } from '../../hooks';

interface CopyButtonProps {
  textToCopy: string;
  copyButtonText?: string;
  size?: 'default' | 'small';
}

export function CopyButton(props: CopyButtonProps) {
  const { textToCopy, size = 'default', copyButtonText = 'Copy' } = props;

  const { isCopied, copyToClipboard } = useCopyToClipboard({ textToCopy });

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
