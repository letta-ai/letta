import {
  type FileMetadata,
  type ListSourceFilesResponse,
  useSourcesServiceGetFileMetadata,
  UseSourcesServiceListSourceFilesKeyFn,
} from '@letta-cloud/sdk-core';
import {
  ArticleIcon,
  Badge,
  Button,
  CancelIcon,
  Dialog,
  FileIcon,
  HStack,
  InfoIcon,
  LoadingEmptyStatusComponent,
  Skeleton,
  Tooltip,
  TrashIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import './FileView.scss';
import { DeleteFileModal } from '../../../DeleteFileModal';
import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_FILE_LIMIT } from '../../../../constants';
import { MarkdownViewer } from './MarkdownViewer';
import { FileOpenStatus } from './FileOpenStatus';

interface FileContentProps {
  file: FileMetadata;
}

function FileContent(props: FileContentProps) {
  const { file } = props;
  const { data } = useSourcesServiceGetFileMetadata(
    {
      fileId: file.id || '',
      sourceId: file.source_id || '',
      includeContent: true,
    },
    undefined,
    {
      enabled: !!file.id,
    },
  );

  const t = useTranslations('ADE/DataSources/ExpandedFileView');

  if (data) {
    return <MarkdownViewer content={data.content || ''} />;
  }

  return (
    <LoadingEmptyStatusComponent isLoading loadingMessage={t('loading')} />
  );
}

interface ExpandedFileViewProps {
  trigger: React.ReactNode;
  file: FileMetadata;
}

function ExpandedFileView(props: ExpandedFileViewProps) {
  const { trigger, file } = props;
  const t = useTranslations('ADE/DataSources/ExpandedFileView');

  const title = useMemo(() => {
    if (file.file_name) {
      // remove file extension
      return file.file_name.split('.').slice(0, -1).join('.') || t('untitled');
    }

    return t('untitled');
  }, [file.file_name, t]);

  return (
    <Dialog
      trigger={trigger}
      size="xlarge"
      title={title}
      hideFooter
      headerVariant="emphasis"
      additionalActions={
        <DeleteFileModal
          sourceId={file.source_id || ''}
          fileId={file.id || ''}
          fileName={file.file_name || ''}
          trigger={
            <Button
              size="xsmall"
              preIcon={<TrashIcon />}
              label={t('delete')}
              color="tertiary"
              hideLabel
            />
          }
        />
      }
    >
      <VStack
        className="max-h-[80vh]"
        fullWidth
        overflow="hidden"
        fullHeight
        paddingBottom
      >
        <HStack align="center">
          <FileStats file={file} />
          <Badge
            border
            size="small"
            preIcon={<InfoIcon />}
            content={t('warning')}
          />
        </HStack>
        <HStack
          className="min-h-[500px]"
          padding="small"
          overflowY="auto"
          collapseHeight
          flex
          border
          color="background"
        >
          <FileContent file={file} />
        </HStack>
      </VStack>
    </Dialog>
  );
}

interface FileViewActionsProps {
  file: FileMetadata;
}

function FileViewActions(props: FileViewActionsProps) {
  const { file } = props;
  const t = useTranslations('ADE/DataSources/FileViewActions');
  return (
    <HStack border color="background" gap={false}>
      <DeleteFileModal
        sourceId={file.source_id || ''}
        fileId={file.id || ''}
        fileName={file.file_name || ''}
        trigger={
          <Button
            size="xsmall"
            preIcon={<TrashIcon size="small" />}
            label={t('delete')}
            color="tertiary"
            hideLabel
          />
        }
      />
      <ExpandedFileView
        file={file}
        trigger={
          <Button
            size="xsmall"
            preIcon={<FileIcon size="xsmall" />}
            label={t('view')}
            color="tertiary"
            hideLabel
          />
        }
      />
      <FileOpenStatus file={file} />
    </HStack>
  );
}

interface FileStatsProps {
  file: FileMetadata;
}

function FileStats(props: FileStatsProps) {
  const { file } = props;

  const { file_name, file_size } = file;

  const fileTypeName = useMemo(() => {
    const parts = (file_name || '').split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toUpperCase();
    }
    return 'Text';
  }, [file_name]);

  const { dynamicFileSize } = useFormatters();

  return (
    <HStack gap="medium" align="center">
      <HStack gap="small">
        <ArticleIcon color="lighter" />
        <Typography color="lighter" variant="body3">
          {fileTypeName}
        </Typography>
      </HStack>

      <Typography color="lighter" variant="body3">
        {dynamicFileSize(file_size || 0)}
      </Typography>
    </HStack>
  );
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

interface FileStatusProps {
  file: FileMetadata;
}

function FileStatus(props: FileStatusProps) {
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

interface FileViewFooterProps {
  file: FileMetadata;
}

function FileViewFooter(props: FileViewFooterProps) {
  const { file } = props;

  const t = useTranslations('ADE/DataSources/FileViewFooter');

  if (file.processing_status === 'completed') {
    return <FileStats file={file} />;
  }

  if (file.processing_status === 'error') {
    return (
      <DeleteFileModal
        sourceId={file.source_id}
        fileId={file.id || ''}
        fileName={file.file_name || ''}
        trigger={
          <Button
            size="xsmall"
            bold
            preIcon={<TrashIcon />}
            label={t('removeFile')}
            color="tertiary"
          />
        }
      />
    );
  }

  return (
    <Skeleton className="h-[16px] w-full bg-background-grey3 max-w-[70%]" />
  );
}

interface FileViewProps {
  file: FileMetadata;
}

function getIsFinishedStatus(file: FileMetadata) {
  return (
    file.processing_status === 'completed' || file.processing_status === 'error'
  );
}

// Hook for smooth progress animation
function useSmoothProgress(actualPercentage: number, isActive: boolean) {
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

export function FileView(props: FileViewProps) {
  const { file } = props;
  const { file_name } = file;
  const queryClient = useQueryClient();

  const hasCompleted = useRef<boolean>(false);

  const { data } = useSourcesServiceGetFileMetadata(
    {
      fileId: file.id || '',
      sourceId: file.source_id,
    },
    undefined,
    {
      enabled: !!file.id,
      refetchInterval: getIsFinishedStatus(file) ? false : 3000,
    },
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    if (hasCompleted.current) {
      return;
    }

    hasCompleted.current = getIsFinishedStatus(data);

    queryClient.setQueriesData<ListSourceFilesResponse | undefined>(
      {
        queryKey: UseSourcesServiceListSourceFilesKeyFn({
          sourceId: file.source_id,
          limit: DEFAULT_FILE_LIMIT,
        }),
      },
      (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return oldData.map((f) => (f.id === data.id ? data : f));
      },
    );
  }, [data, file.source_id, queryClient]);

  return (
    <VStack
      className="fileview hover:bg-background-grey2"
      position="relative"
      border
      padding="small"
    >
      {file?.processing_status === 'completed' && (
        <>
          <div className="fileview-inner">
            <FileViewActions file={file} />
          </div>
          <div className="fileview-agent-status">
            <HStack border="transparent">
              <FileOpenStatus file={file} />
            </HStack>
          </div>
        </>
      )}
      <HStack align="center">
        <Typography fullWidth overflow="ellipsis" noWrap variant="body3">
          {file_name}
        </Typography>
        <FileStatus file={file} />
      </HStack>
      <HStack>
        <FileViewFooter file={file} />
      </HStack>
    </VStack>
  );
}
