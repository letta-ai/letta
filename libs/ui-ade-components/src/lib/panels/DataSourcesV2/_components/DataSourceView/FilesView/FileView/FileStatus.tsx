import type { FileMetadata } from '@letta-cloud/sdk-core';
import {
  Badge,
  CancelIcon,
  Dialog,
  HStack,
  Tooltip,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';

// Hook for smooth progress animation
export function useSmoothProgress(actualPercentage: number, isActive: boolean) {
  const [displayPercentage, setDisplayPercentage] = useState(0);
  const animationRef = useRef<number | undefined>(undefined);
  const lastActualPercentage = useRef(actualPercentage);

  useEffect(() => {
    if (!isActive) {
      setDisplayPercentage(0);
      return;
    }

    const startTime = Date.now();
    const duration = 2000; // 2 seconds to reach target
    const startPercentage = displayPercentage;
    const targetPercentage = Math.max(
      actualPercentage,
      lastActualPercentage.current,
    );

    // If the actual percentage hasn't changed, add a small increment to keep animation going
    const finalTarget =
      actualPercentage === lastActualPercentage.current
        ? Math.min(targetPercentage + 2, 95) // Cap at 95% to avoid reaching 100% prematurely
        : targetPercentage;

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);

      const newPercentage = Math.round(
        startPercentage + (finalTarget - startPercentage) * easeOutQuart,
      );

      setDisplayPercentage(newPercentage);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // When animation completes, start a new one if we're still active
        if (isActive && actualPercentage < 100) {
          setTimeout(() => {
            lastActualPercentage.current = finalTarget;
            // Trigger a new animation cycle
            setDisplayPercentage((prev) => prev);
          }, 500);
        }
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [actualPercentage, isActive, displayPercentage]);

  // Update last actual percentage when it changes
  useEffect(() => {
    lastActualPercentage.current = actualPercentage;
  }, [actualPercentage]);

  return displayPercentage;
}

interface ErrorViewDialogProps {
  file: FileMetadata;
  trigger: React.ReactNode;
}

function ErrorViewDialog(props: ErrorViewDialogProps) {
  const { file, trigger } = props;

  const t = useTranslations('ADE/DataSources/ErrorViewDialog');

  return (
    <Dialog hideFooter title={t('title')} trigger={trigger}>
      <VStack paddingBottom>
        <HStack border color="background" padding="small">
          <Typography variant="body2">{file.error_message}</Typography>
        </HStack>
      </VStack>
    </Dialog>
  );
}

export interface FileStatusProps {
  file: FileMetadata;
}

export function FileStatus(props: FileStatusProps) {
  const { file } = props;

  const t = useTranslations('ADE/DataSources/FileStatus');

  // Calculate actual percentage for embedding progress
  function getActualPercentage() {
    const totalChunks = file.total_chunks || 0;
    const chunksEmbedded = file.chunks_embedded || 0;
    return totalChunks > 0
      ? Math.round((chunksEmbedded / totalChunks) * 100)
      : 0;
  }

  // Use smooth progress animation for embedding states
  const isEmbeddingActive = Boolean(
    file.processing_status === 'embedding' ||
      (file.processing_status === 'parsing' &&
        file.total_chunks &&
        file.total_chunks > 0),
  );

  const actualPercentage = getActualPercentage();
  const smoothPercentage = useSmoothProgress(
    actualPercentage,
    isEmbeddingActive,
  );

  switch (file.processing_status) {
    case undefined:
      return (
        <Badge
          border
          variant="warning"
          busy
          size="small"
          content={t('statuses.parsing')}
        />
      );
    case 'error':
      return (
        <ErrorViewDialog
          file={file}
          trigger={
            <button>
              <Tooltip asChild content={t('errorTooltip')}>
                <Badge
                  border
                  preIcon={<CancelIcon />}
                  variant="destructive"
                  size="small"
                  content={t('statuses.error')}
                />
              </Tooltip>
            </button>
          }
        />
      );
    case 'pending':
      return (
        <Badge
          border
          busy
          variant="warning"
          size="small"
          content={t('statuses.pending')}
        />
      );
    case 'parsing': {
      // Check if we're actually in the embedding phase (totalChunks available but chunksEmbedded is 0)
      const totalChunks = file.total_chunks || 0;
      const chunksEmbedded = file.chunks_embedded || 0;

      // If we have totalChunks but chunksEmbedded is 0, we're actually in embedding phase
      if (totalChunks > 0 && chunksEmbedded === 0) {
        const embeddingText = t('statuses.embeddingWithProgress', {
          percentage: smoothPercentage,
        });

        return (
          <Badge
            border
            busy
            variant="success"
            size="small"
            content={embeddingText}
          />
        );
      }

      return (
        <Badge
          border
          busy
          variant="warning"
          size="small"
          content={t('statuses.parsing')}
        />
      );
    }
    case 'embedding': {
      const totalChunks = file.total_chunks || 0;

      const embeddingText =
        totalChunks > 0
          ? t('statuses.embeddingWithProgress', {
              percentage: smoothPercentage,
            })
          : t('statuses.embedding');

      return (
        <Badge
          border
          busy
          variant="success"
          size="small"
          content={embeddingText}
        />
      );
    }
    case 'completed':
      return null;
  }
}
