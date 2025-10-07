import React, { useCallback, useMemo, useRef } from 'react';
import {
  isAPIError,
  type ListSourceFilesResponse,
  useFoldersServiceListFolderFiles,
  useFoldersServiceUploadFileToFolder,
  UseFoldersServiceListFolderFilesKeyFn,
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
import { DEFAULT_FILE_LIMIT } from '../../../constants';
import { VirtualizedFilesContainer } from './VirtualizedFilesContainer';

export interface FilesViewProps {
  sourceId: string;
  search?: string;
}

export function FilesView(props: FilesViewProps) {
  const { sourceId, search = '' } = props;

  const t = useTranslations('ADE/DataSources/FilesView');
  const uploadT = useTranslations('ADE/EditDataSourcesPanel.NoFilesView');
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: allFiles, isError } = useFoldersServiceListFolderFiles(
    {
      folderId: sourceId,
      limit: DEFAULT_FILE_LIMIT,
    },
    undefined,
  );

  // Filter files based on search query
  const files = useMemo(() => {
    if (!allFiles) return allFiles;

    if (!search.trim()) {
      return allFiles;
    }

    const searchLower = search.toLowerCase();
    return allFiles.filter((file) => {
      const fileName = file.file_name?.toLowerCase() || '';
      return fileName.includes(searchLower);
    });
  }, [allFiles, search]);

  const { mutate, error, reset } = useFoldersServiceUploadFileToFolder({
    onSuccess: (uploadedFile) => {
      void queryClient.setQueriesData<ListSourceFilesResponse | undefined>(
        {
          queryKey: UseFoldersServiceListFolderFilesKeyFn({
            folderId: sourceId,
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
          folderId: sourceId,
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

  const dragProps =
    files.length > 0
      ? {
          onDragEnter: handleDragEnter,
          onDragLeave: handleDragLeave,
          onDragOver: handleDragOver,
          onDrop: handleDrop,
        }
      : {};

  return (
    <div className="relative h-full w-full flex flex-col">
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

      {files.length > 0 ? (
        <div
          ref={dropZoneRef}
          className="relative h-full w-full"
          {...dragProps}
        >
          <VirtualizedFilesContainer files={files} />
        </div>
      ) : (
        <DataSourceFileUpload sourceId={sourceId} />
      )}

      {errorMessage && files.length > 0 && (
        <div className="bg-chip-destructive rounded-sm">
          <VStack padding="xsmall">
            <Typography variant="body2" align="center" bold>
              {errorMessage}
            </Typography>
          </VStack>
        </div>
      )}
    </div>
  );
}
