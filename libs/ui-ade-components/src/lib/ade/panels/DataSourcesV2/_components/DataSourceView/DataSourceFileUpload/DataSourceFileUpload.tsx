import { useTranslations } from '@letta-cloud/translations';
import { useCallback, useMemo, useRef } from 'react';
import {
  isAPIError,
  type ListSourceFilesResponse,
  useFoldersServiceUploadFileToFolder,
  UseFoldersServiceListFolderFilesKeyFn,
  ACCEPTABLE_FILETYPES,
} from '@letta-cloud/sdk-core';
import {
  Button,
  UploadIcon,
  VStack,
  Typography,
  FileIcon,
  BillingLink,
  useDragAndDrop,
} from '@letta-cloud/ui-component-library';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@letta-cloud/ui-styles';
import { DEFAULT_FILE_LIMIT } from '../../../constants';

interface NoFilesViewProps {
  sourceId: string;
  onUploadComplete?: () => void;
}

export function DataSourceFileUpload(props: NoFilesViewProps) {
  const { sourceId, onUploadComplete } = props;
  const t = useTranslations('ADE/EditDataSourcesPanel.NoFilesView');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLElement>(null);
  const queryClient = useQueryClient();

  const { mutate, error, isPending } = useFoldersServiceUploadFileToFolder({
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
      onUploadComplete?.();
    },
  });

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error)) {
        if (error.body.errorCode === 'file_size_exceeded') {
          return t('errors.fileSizeExceeded', {
            limit: error.body.limit || '5MB',
          });
        }

        if (error.body.errorCode === 'storage_exceeded') {
          return t.rich('errors.storageExceeded', {
            limit: error.body.limit || '5MB',
            link: (chunks) => <BillingLink>{chunks}</BillingLink>,
          });
        }

        if (error.body.errorCode === 'file_upload_rate_limit_exceeded') {
          return t.rich('errors.rateLimitExceeded', {
            limit: error.body.limit || '10',
            link: (chunks) => <BillingLink>{chunks}</BillingLink>,
          });
        }

        if (error.body.errorCode === 'file_upload_size_rate_limit_exceeded') {
          return t.rich('errors.fileUploadSizeRateLimitExceeded', {
            limit: error.body.limit || '10MB',
            link: (chunks) => <BillingLink>{chunks}</BillingLink>,
          });
        }
      }

      return t('errors.genericError');
    }

    return undefined;
  }, [error, t]);

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

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
  } = useDragAndDrop({
    onFilesSelected: handleFileSelect,
    acceptMultiple: false,
    dropZoneRef,
  });

  return (
    <VStack
      ref={dropZoneRef}
      fullWidth
      fullHeight
      padding="small"
      border="dashed"
      className={cn(isDragging && 'bg-background-grey')}
      align="center"
      justify="center"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
        accept={ACCEPTABLE_FILETYPES.join(',')}
      />
      <VStack align="center" gap="large">
        <VStack gap="medium" align="center">
          {isDragging ? (
            <FileIcon size="xxlarge" />
          ) : (
            <UploadIcon color="muted" size="xxlarge" />
          )}
          <Typography variant="body2">{t('dragAndDrop')}</Typography>
          <Typography color="lighter" variant="body2">
            {t('or')}
          </Typography>
          <Button
            color="secondary"
            size="small"
            preIcon={<UploadIcon />}
            onClick={handleButtonClick}
            busy={isPending}
            label={t('uploadButton')}
          />
        </VStack>
        {errorMessage && (
          <div className="bg-chip-destructive rounded-sm">
            <VStack padding="xsmall">
              <Typography variant="body2" align="center" bold>
                {errorMessage}
              </Typography>
            </VStack>
          </div>
        )}
      </VStack>
    </VStack>
  );
}
