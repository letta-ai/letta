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
  VStack,
  HStack,
  Typography,
  LoadingEmptyStatusComponent,
  ArticleIcon,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import type { FileMetadata } from '@letta-cloud/sdk-core';
import {
  UseJobsServiceListActiveJobsKeyFn,
  UseSourcesServiceListSourceFilesKeyFn,
  useSourcesServiceUploadFileToSource,
  useSourcesServiceGetFileMetadata,
} from '@letta-cloud/sdk-core';
import { useSourcesServiceListSourceFiles } from '@letta-cloud/sdk-core';
import { useCurrentDataSourceId } from '../hooks';
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { DeleteFileDialog } from '@letta-cloud/ui-ade-components';
import type { DeleteFilePayload } from '@letta-cloud/ui-ade-components';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useFormatters } from '@letta-cloud/utils-client';

const uploadToFormValuesSchema = z.object({
  file: z.custom<File>((v) => v instanceof File),
});

type UploadToFormValues = z.infer<typeof uploadToFormValuesSchema>;

interface UploadFileDialogProps {
  limit: number;
}

function UploadFileDialog({ limit }: UploadFileDialogProps) {
  const t = useTranslations('data-sources/files/page');
  const dataSourceId = useCurrentDataSourceId();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { mutate, isPending } = useSourcesServiceUploadFileToSource({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: UseSourcesServiceListSourceFilesKeyFn({
          sourceId: dataSourceId,
          after: undefined,
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

  const [canUpdateDataSource] = useUserHasPermission(
    ApplicationServices.UPDATE_DATA_SOURCE,
  );

  if (!canUpdateDataSource) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={setIsDialogOpen}
        isOpen={isDialogOpen}
        onSubmit={form.handleSubmit(onSubmit)}
        title={t('uploadDialog.title')}
        confirmText={t('uploadDialog.confirmText')}
        isConfirmBusy={isPending}
        trigger={
          <Button
            label={t('uploadDialog.triggerLabel')}
            preIcon={<UploadIcon />}
          />
        }
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

interface FileStatsProps {
  file: FileMetadata;
}

function FileStats(props: FileStatsProps) {
  const t = useTranslations('data-sources/files/page');
  const { file } = props;

  const { file_name, file_size } = file;

  const fileTypeName = useMemo(() => {
    const parts = (file_name || '').split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toUpperCase();
    }
    return t('fileType.defaultType');
  }, [file_name, t]);

  const { dynamicFileSize } = useFormatters();

  return (
    <HStack gap="medium" align="center">
      <HStack gap="small">
        <ArticleIcon color="lighter" />
        <Typography color="lighter" variant="body2">
          {fileTypeName}
        </Typography>
      </HStack>

      <Typography color="lighter" variant="body2">
        {dynamicFileSize(file_size || 0)}
      </Typography>
    </HStack>
  );
}

interface FileViewDialogProps {
  file: FileMetadata;
  isOpen: boolean;
  onClose: () => void;
}

function FileViewDialog({ file, isOpen, onClose }: FileViewDialogProps) {
  const t = useTranslations('data-sources/files/page');
  const { data } = useSourcesServiceGetFileMetadata(
    {
      fileId: file.id || '',
      sourceId: file.source_id || '',
      includeContent: true,
    },
    undefined,
    {
      enabled: !!file.id && isOpen,
    },
  );

  const title = useMemo(() => {
    if (file.file_name) {
      return (
        file.file_name.split('.').slice(0, -1).join('.') ||
        t('fileType.untitled')
      );
    }
    return t('fileType.untitled');
  }, [file.file_name, t]);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      trigger={null}
      size="xlarge"
      title={title}
      hideFooter
      headerVariant="emphasis"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <VStack fullWidth overflow="hidden" fullHeight paddingBottom>
        <HStack align="center">
          <FileStats file={file} />
        </HStack>
        <HStack
          padding="small"
          overflowY="auto"
          collapseHeight
          flex
          border
          color="background"
        >
          {data ? (
            data.content ? (
              <Typography>{data.content}</Typography>
            ) : (
              <Typography italic>{t('fileContent.noContent')}</Typography>
            )
          ) : (
            <LoadingEmptyStatusComponent
              isLoading
              loadingMessage={t('fileContent.loading')}
            />
          )}
        </HStack>
      </VStack>
    </Dialog>
  );
}

function DataSourceFilesPage() {
  const sourceId = useCurrentDataSourceId();
  const t = useTranslations('data-sources/files/page');
  const [limit, setLimit] = useState<number>(0);
  const [cursor, setCursor] = useState<FileMetadata | undefined>(undefined);

  const { data: files, isError } = useSourcesServiceListSourceFiles(
    {
      sourceId,
      limit,
      after: cursor?.id,
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

  const [fileToView, setFileToView] = useState<FileMetadata | null>(null);
  const { dynamicFileSize } = useFormatters();

  const fileTableColumns: Array<ColumnDef<FileMetadata>> = useMemo(
    () => [
      {
        header: t('table.columns.name'),
        accessorKey: 'file_name',
      },
      {
        header: t('table.columns.fileSize'),
        accessorKey: 'file_size',
        cell: ({ row }) => {
          return (
            <Typography>
              {dynamicFileSize(row.original.file_size || 0)}
            </Typography>
          );
        },
      },
      {
        header: '',
        id: 'actions',
        cell: ({ cell }) => {
          return (
            <DropdownMenu
              triggerAsChild
              trigger={
                <Button
                  label={t('actions')}
                  hideLabel
                  preIcon={<DotsHorizontalIcon />}
                  color="tertiary"
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
      {
        header: '',
        id: 'view',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        accessorKey: 'id',
        cell: ({ cell }) => (
          <Button
            color="secondary"
            label={t('viewButton')}
            onClick={() => {
              setFileToView(cell.row.original);
            }}
          />
        ),
      },
    ],
    [sourceId, t, dynamicFileSize],
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
      <FileViewDialog
        file={fileToView || ({} as FileMetadata)}
        isOpen={!!fileToView}
        onClose={() => {
          setFileToView(null);
        }}
      />
      <DashboardPageLayout
        actions={<UploadFileDialog limit={limit} />}
        title={t('title')}
        encapsulatedFullHeight
      >
        <DashboardPageSection fullHeight>
          <DataTable
            columns={fileTableColumns}
            data={files || []}
            isLoading={!files}
            autofitHeight
            onSetCursor={setCursor}
            onLimitChange={setLimit}
            noResultsText={t('emptyMessage')}
            errorMessage={isError ? t('emptyMessage') : ''}
          />
        </DashboardPageSection>
      </DashboardPageLayout>
    </>
  );
}

export default DataSourceFilesPage;
