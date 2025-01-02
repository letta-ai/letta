'use client';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  FormField,
  FormProvider,
  SingleFileUpload,
  UploadIcon,
  useForm,
} from '@letta-web/component-library';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import type { FileMetadata } from '@letta-web/letta-agents-api';
import {
  UseJobsServiceListActiveJobsKeyFn,
  UseSourcesServiceListFilesFromSourceKeyFn,
  useSourcesServiceUploadFileToSource,
} from '@letta-web/letta-agents-api';
import { useSourcesServiceListFilesFromSource } from '@letta-web/letta-agents-api';
import { useCurrentDataSourceId } from '../hooks';
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { DeleteFileDialog } from '@letta-cloud/shared-ade-components';
import type { DeleteFilePayload } from '@letta-cloud/shared-ade-components';

const uploadToFormValuesSchema = z.object({
  file: z.custom<File>((v) => v instanceof File),
});

type UploadToFormValues = z.infer<typeof uploadToFormValuesSchema>;

interface UploadFileDialogProps {
  limit: number;
}

function UploadFileDialog({ limit }: UploadFileDialogProps) {
  const dataSourceId = useCurrentDataSourceId();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { mutate, isPending } = useSourcesServiceUploadFileToSource({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: UseSourcesServiceListFilesFromSourceKeyFn({
          sourceId: dataSourceId,
          cursor: undefined,
          limit,
        }),
      });

      void queryClient.invalidateQueries({
        queryKey: UseJobsServiceListActiveJobsKeyFn(),
      });

      setIsDialogOpen(false);
    },
  });

  const form = useForm<UploadToFormValues>({
    resolver: zodResolver(uploadToFormValuesSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    return () => {
      form.reset();
    };
  }, [form]);

  const onSubmit = useCallback(
    (values: UploadToFormValues) => {
      mutate({
        formData: { file: values.file },
        sourceId: dataSourceId,
      });
    },
    [dataSourceId, mutate],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={setIsDialogOpen}
        isOpen={isDialogOpen}
        onSubmit={form.handleSubmit(onSubmit)}
        title="Upload File"
        confirmText="Upload"
        isConfirmBusy={isPending}
        trigger={<Button label="Upload File" preIcon={<UploadIcon />} />}
      >
        <FormField
          render={({ field }) => (
            <SingleFileUpload fullWidth {...field} hideLabel label="file" />
          )}
          name="file"
        />
      </Dialog>
    </FormProvider>
  );
}

function DataSourceFilesPage() {
  const sourceId = useCurrentDataSourceId();
  const t = useTranslations('data-sources/files/page');
  const [limit, setLimit] = useState<number>(0);
  const [cursor, setCursor] = useState<FileMetadata | undefined>(undefined);

  const { data: files, isError } = useSourcesServiceListFilesFromSource(
    {
      sourceId,
      limit,
      cursor: cursor?.id,
    },
    undefined,
    {
      enabled: limit > 0,
    },
  );

  const [fileToDelete, setFileToDelete] = useState<Omit<
    DeleteFilePayload,
    'onClose'
  > | null>(null);

  const fileTableColumns: Array<ColumnDef<FileMetadata>> = useMemo(
    () => [
      {
        header: t('table.columns.name'),
        accessorKey: 'file_name',
      },
      {
        header: t('table.columns.fileSize'),
        accessorKey: 'file_size',
      },
      {
        header: t('table.columns.lastModified'),
        accessorKey: 'file_last_modified_date',
      },
      {
        header: '',
        id: 'actions',
        cell: ({ cell }) => {
          return (
            <DropdownMenu
              trigger={
                <Button
                  label={t('actions')}
                  hideLabel
                  preIcon={<DotsHorizontalIcon />}
                  color="tertiary-transparent"
                />
              }
            >
              <DropdownMenuItem
                onClick={() => {
                  setFileToDelete({
                    sourceId,
                    fileId: cell.row.original.id || '',
                    fileName: cell.row.original.file_name || '',
                  });
                }}
                label={t('deleteFile')}
              />
            </DropdownMenu>
          );
        },
        accessorKey: 'id',
      },
    ],
    [sourceId, t],
  );

  return (
    <>
      {fileToDelete && (
        <DeleteFileDialog
          limit={limit}
          sourceId={sourceId}
          fileId={fileToDelete.fileId}
          fileName={fileToDelete.fileName}
          onClose={() => {
            setFileToDelete(null);
          }}
        />
      )}
      <DashboardPageLayout
        actions={<UploadFileDialog limit={limit} />}
        title={t('title')}
      >
        <DashboardPageSection>
          <DataTable
            columns={fileTableColumns}
            data={files || []}
            isLoading={!files}
            autofitHeight
            onSetCursor={setCursor}
            onLimitChange={setLimit}
            errorMessage={isError ? t('emptyMessage') : ''}
          />
        </DashboardPageSection>
      </DashboardPageLayout>
    </>
  );
}

export default DataSourceFilesPage;
