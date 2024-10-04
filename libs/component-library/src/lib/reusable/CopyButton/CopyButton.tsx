'use client';
import * as React from 'react';
import { Button } from '../../core/Button/Button';
import { CheckIcon, ClipboardIcon } from '../../icons';
import { useCopyToClipboard } from '../../hooks';

interface CopyButtonProps {
  textToCopy: string;
  testId?: string;
  copyButtonText?: string;
  color?: 'tertiary-transparent' | 'tertiary';
  size?: 'default' | 'small';
  hideLabel?: boolean;
}

export function CopyButton(props: CopyButtonProps) {
  const {
    textToCopy,
    testId,
    size = 'default',
    color = 'tertiary',
    copyButtonText = 'Copy',
    hideLabel,
  } = props;

  const { isCopied, copyToClipboard } = useCopyToClipboard({ textToCopy });

  return (
    <Button
      size={size}
      color={color}
      hideLabel={hideLabel}
      type="button"
      data-testid={testId}
      preIcon={isCopied ? <CheckIcon /> : <ClipboardIcon />}
      label={isCopied ? 'Copied' : copyButtonText}
      onClick={() => {
        void copyToClipboard();
      }}
    />
  );
}
