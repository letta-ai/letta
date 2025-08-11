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
  copiedText?: string;
  color?: 'secondary' | 'tertiary';
  size?: '3xsmall' | 'default' | 'small' | 'xsmall';
  hideLabel?: boolean;
  square?: boolean;
  iconColor?: 'destructive' | 'muted' | 'positive';
  _use_rarely_className?: string;
}

export function CopyButton(props: CopyButtonProps) {
  const {
    textToCopy,
    testId,
    size = 'default',
    fullWidth,
    color = 'tertiary',
    copyButtonText = 'Copy',
    copiedText = 'Copied',
    hideLabel,
    square,
    iconColor,
    _use_rarely_className,
  } = props;

  const { isCopied, copyToClipboard } = useCopyToClipboard({ textToCopy });

  return (
    <Button
      size={size}
      fullWidth={fullWidth}
      color={color}
      hideLabel={hideLabel}
      square={square}
      type="button"
      data-testid={testId}
      _use_rarely_className={_use_rarely_className}
      preIcon={
        isCopied ? (
          <CheckIcon color={iconColor} size="auto" />
        ) : (
          <CopyIcon color={iconColor} size="auto" />
        )
      }
      label={isCopied ? copiedText : copyButtonText}
      onClick={() => {
        void copyToClipboard();
      }}
    />
  );
}
