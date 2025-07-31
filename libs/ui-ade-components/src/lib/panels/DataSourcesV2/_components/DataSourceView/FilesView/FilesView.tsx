import React, { useCallback, useMemo, useRef } from 'react';
import {
  useSourcesServiceListSourceFiles,
  isAPIError,
  type ListSourceFilesResponse,
  useSourcesServiceUploadFileToSource,
  UseSourcesServiceListSourceFilesKeyFn,
} from '@letta-cloud/sdk-core';
import {
  Alert,
  LoadingEmptyStatusComponent,
  VStack,
  BillingLink,
  Typography,
  FileIcon,
  useDragAndDrop,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useQueryClient } from '@tanstack/react-query';
import { DataSourceFileUpload } from '../DataSourceFileUpload/DataSourceFileUpload';
import { FileView } from './FileView/FileView';
import { DEFAULT_FILE_LIMIT } from '../../../constants';

interface FilesViewProps {
  sourceId: string;
}

export function FilesView(props: FilesViewProps) {
  const { sourceId } = props;

  const t = useTranslations('ADE/DataSources/FilesView');
  const uploadT = useTranslations('ADE/EditDataSourcesPanel.NoFilesView');
  const dropZoneRef = useRef<HTMLElement>(null);
  const queryClient = useQueryClient();

  const { data: files, isError } = useSourcesServiceListSourceFiles(
    {
      sourceId,
      limit: DEFAULT_FILE_LIMIT,
    },
    undefined,
  );

  const { mutate, error, reset } = useSourcesServiceUploadFileToSource({
    onSuccess: (uploadedFile) => {
      void queryClient.setQueriesData<ListSourceFilesResponse | undefined>(
        {
          queryKey: UseSourcesServiceListSourceFilesKeyFn({
            sourceId,
            limit: DEFAULT_FILE_LIMIT,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return [uploadedFile, ...oldData];
        },
      );
      reset();
    },
  });

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error)) {
        if (error.body.errorCode === 'file_size_exceeded') {
          return uploadT('errors.fileSizeExceeded', {
            limit: error.body.limit || '5MB',
          });
        }

        if (error.body.errorCode === 'storage_exceeded') {
          return uploadT.rich('errors.storageExceeded', {
            limit: error.body.limit || '5MB',
            link: (chunks) => <BillingLink>{chunks}</BillingLink>,
          });
        }

        if (error.body.errorCode === 'file_upload_rate_limit_exceeded') {
          return uploadT.rich('errors.rateLimitExceeded', {
            limit: error.body.limit || '10',
            link: (chunks) => <BillingLink>{chunks}</BillingLink>,
          });
        }

        if (error.body.errorCode === 'file_upload_size_rate_limit_exceeded') {
          return uploadT.rich('errors.fileUploadSizeRateLimitExceeded', {
            limit: error.body.limit || '10MB',
            link: (chunks) => <BillingLink>{chunks}</BillingLink>,
          });
        }
      }

      return uploadT('errors.genericError');
    }

    return undefined;
  }, [error, uploadT]);

  const handleFileSelect = useCallback(
    (files: FileList) => {
      if (files && files.length > 0) {
        const file = files[0];
        mutate({
          formData: { file },
          sourceId: sourceId,
        });
      }
    },
    [mutate, sourceId],
  );

  const {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useDragAndDrop({
    onFilesSelected: handleFileSelect,
    acceptMultiple: false,
    dropZoneRef,
  });

  if (!files) {
    return <LoadingEmptyStatusComponent noMinHeight loaderVariant="grower" />;
  }

  if (isError) {
    return <Alert title={t('error')} variant="destructive" />;
  }

  return (
    <VStack
      ref={dropZoneRef}
      fullHeight
      className="relative"
      onDragEnter={files.length > 0 ? handleDragEnter : undefined}
      onDragLeave={files.length > 0 ? handleDragLeave : undefined}
      onDragOver={files.length > 0 ? handleDragOver : undefined}
      onDrop={files.length > 0 ? handleDrop : undefined}
    >
      {isDragging && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center transition-all"
          style={{
            border: '2px dotted hsl(var(--border-drag))',
            backgroundColor: 'hsl(var(--background-grey))',
          }}
        >
          <VStack align="center" gap="medium">
            <FileIcon size="xxlarge" color="brand" />
            <Typography variant="body" align="center" bold>
              {t('dragAndDrop.dropMessage')}
            </Typography>
          </VStack>
        </div>
      )}

      {files.map((file) => (
        <FileView key={file.id || ''} file={file} />
      ))}
      {files.length === 0 && <DataSourceFileUpload sourceId={sourceId} />}
      {errorMessage && files.length > 0 && (
        <div className="bg-chip-destructive rounded-sm">
          <VStack padding="xsmall">
            <Typography variant="body2" align="center" bold>
              {errorMessage}
            </Typography>
          </VStack>
        </div>
      )}
    </VStack>
  );
}
