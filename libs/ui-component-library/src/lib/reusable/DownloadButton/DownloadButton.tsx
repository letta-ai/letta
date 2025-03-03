'use client';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../core/Button/Button';
import { CheckIcon, DownloadIcon } from '../../icons';

interface CopyButtonProps {
  textToDownload: string;
  fileName?: string;
  fullWidth?: boolean;
  downloadButtonText?: string;
  size?: 'default' | 'small';
}

export function DownloadButton(props: CopyButtonProps) {
  const {
    textToDownload,
    size = 'default',
    fileName,
    fullWidth,
    downloadButtonText = 'Download',
  } = props;
  const [isCopied, setIsCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const downloadFile = useCallback(() => {
    try {
      const blob = new Blob([textToDownload], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'file.txt';
      a.click();
      URL.revokeObjectURL(url);
      setIsCopied(true);
      timer.current = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (_) {
      alert('Failed to start download');
    }
  }, [fileName, textToDownload]);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  return (
    <Button
      fullWidth={fullWidth}
      size={size}
      type="button"
      color="secondary"
      preIcon={isCopied ? <CheckIcon /> : <DownloadIcon />}
      label={isCopied ? 'Download started' : downloadButtonText}
      onClick={downloadFile}
    />
  );
}
