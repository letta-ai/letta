'use client';
import * as React from 'react';
import { Button } from '../../core/Button/Button';
import { CheckIcon, CopyIcon } from '../../icons';
import { useCopyToClipboard } from '../../hooks';

interface CopyButtonProps {
  textToCopy: string;
  testId?: string;
  fullWidth?: boolean;
  copyButtonText?: string;
  color?: 'tertiary-transparent' | 'tertiary';
  size?: 'default' | 'small' | 'xsmall';
  hideLabel?: boolean;
}

export function CopyButton(props: CopyButtonProps) {
  const {
    textToCopy,
    testId,
    size = 'default',
    fullWidth,
    color = 'tertiary',
    copyButtonText = 'Copy',
    hideLabel,
  } = props;

  const { isCopied, copyToClipboard } = useCopyToClipboard({ textToCopy });

  return (
    <Button
      size={size}
      fullWidth={fullWidth}
      color={color}
      hideLabel={hideLabel}
      type="button"
      data-testid={testId}
      preIcon={isCopied ? <CheckIcon /> : <CopyIcon />}
      label={isCopied ? 'Copied' : copyButtonText}
      onClick={() => {
        void copyToClipboard();
      }}
    />
  );
}
