import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback } from 'react';
import {
  type ListSourceFilesResponse,
  useSourcesServiceDeleteFileFromSource,
  UseSourcesServiceListSourceFilesKeyFn,
} from '@letta-cloud/sdk-core';
import { Dialog, Typography } from '@letta-cloud/ui-component-library';
import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_FILE_LIMIT } from '../../constants';

export interface DeleteFileModalProps {
  sourceId: string;
  fileId: string;
  fileName: string;
  trigger: React.ReactNode;
  limit?: number;
}

export function DeleteFileModal(props: DeleteFileModalProps) {
  const { sourceId, fileId, trigger, fileName, limit = DEFAULT_FILE_LIMIT } = props;
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);
  const t = useTranslations('ADE/EditDataSourcesPanel.DeleteFileModal');

  const { mutate, isPending, isError } = useSourcesServiceDeleteFileFromSource({
    onSuccess: () => {
      queryClient.setQueriesData<ListSourceFilesResponse | undefined>(
        {
          queryKey: UseSourcesServiceListSourceFilesKeyFn({
            sourceId,
            limit,
          }),
          exact: false,
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return oldData.filter((file) => file.id !== fileId);
        },
      );

      setIsOpen(false);
    },
  });

  const handleDelete = useCallback(() => {
    mutate({
      sourceId,
      fileId,
    });
  }, [fileId, mutate, sourceId]);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      title={t('title')}
      confirmText={t('confirm')}
      trigger={trigger}
      isConfirmBusy={isPending}
      onConfirm={handleDelete}
      errorMessage={isError ? t('error') : undefined}
      testId="delete-file-modal"
    >
      <Typography>{t('areYouSure', { fileName })}</Typography>
    </Dialog>
  );
}
