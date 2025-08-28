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
  MultiFileUpload,
  UploadIcon,
  useForm,
  VStack,
  HStack,
  Typography,
  LoadingEmptyStatusComponent,
  ArticleIcon,
  VerticalDotsIcon,
  TrashIcon,
  EditIcon,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import type {
  FileMetadata,
  ListSourceFilesResponse,
} from '@letta-cloud/sdk-core';
import { useSourcesServiceRetrieveSource } from '@letta-cloud/sdk-core';
import {
  UseJobsServiceListActiveJobsKeyFn,
  UseSourcesServiceListSourceFilesKeyFn,
  useSourcesServiceUploadFileToSource,
  useSourcesServiceGetFileMetadata,
} from '@letta-cloud/sdk-core';
import { useSourcesServiceListSourceFiles } from '@letta-cloud/sdk-core';
import { useCurrentDataSourceId } from './hooks';
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileStatus } from '@letta-cloud/ui-ade-components';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useFormatters } from '@letta-cloud/utils-client';
import {
  DeleteDataSourceDialog,
  RenameDataSourceDialog,
  UpdateSourceInstructionsModal,
} from '@letta-cloud/ui-ade-components';
import { DeleteFileModal } from '@letta-cloud/ui-ade-components';

const uploadToFormValuesSchema = z.object({
  files: z.array(z.custom<File>((v) => v instanceof File)).min(1),
});

type UploadToFormValues = z.infer<typeof uploadToFormValuesSchema>;

interface UploadFileDialogProps {
  limit: number;
  onUploadComplete?: () => void;
}

function UploadFileDialog({ limit, onUploadComplete }: UploadFileDialogProps) {
  const t = useTranslations('data-sources/files/page');
  const dataSourceId = useCurrentDataSourceId();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const { mutate, isPending } = useSourcesServiceUploadFileToSource({
    onSuccess: (uploadedFile) => {
      void queryClient.setQueriesData<ListSourceFilesResponse | undefined>(
        {
          queryKey: UseSourcesServiceListSourceFilesKeyFn({
            sourceId: dataSourceId,
            after: undefined,
            limit,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return [...oldData, uploadedFile];
        },
      );

      void queryClient.invalidateQueries({
        queryKey: UseJobsServiceListActiveJobsKeyFn(),
      });

      setIsDialogOpen(false);
    },
  });

  const form = useForm<UploadToFormValues>({
    resolver: zodResolver(uploadToFormValuesSchema),
    mode: 'onChange',
    defaultValues: {
      files: [],
    },
  });

  useEffect(() => {
    return () => {
      form.reset();
    };
  }, [form]);

  const onSubmit = useCallback(
    async (values: UploadToFormValues) => {
      for (const file of values.files) {
        try {
          await new Promise<void>((resolve, reject) => {
            mutate(
              {
                formData: { file },
                sourceId: dataSourceId,
              },
              {
                onSuccess: () => {
                  resolve();
                },
                onError: (error) => {
                  reject(error);
                },
              },
            );
          });
        } catch (error) {
          console.error('Failed to upload file:', error);
        }
      }

      void queryClient.invalidateQueries({
        queryKey: UseJobsServiceListActiveJobsKeyFn(),
      });

      setIsDialogOpen(false);
      form.reset({ files: [] });
      onUploadComplete?.();
    },
    [form, mutate, dataSourceId, onUploadComplete, queryClient],
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
        <VStack fullWidth gap="medium">
          <FormField
            render={({ field }) => (
              <MultiFileUpload
                fullWidth
                {...field}
                hideLabel
                label="files"
                maxFiles={10}
              />
            )}
            name="files"
          />
        </VStack>
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

  const { data: source } = useSourcesServiceRetrieveSource({
    sourceId,
  });

  const [isPolling, setIsPolling] = useState(false);

  const { data: files, isError } = useSourcesServiceListSourceFiles(
    {
      sourceId,
      limit,
      after: cursor?.id,
    },
    undefined,
    {
      enabled: limit > 0,
      refetchInterval: isPolling ? 3000 : false,
    },
  );

  const hasProcessingFiles = useMemo(() => {
    return files?.some(
      (file) =>
        file.processing_status !== 'completed' &&
        file.processing_status !== 'error',
    );
  }, [files]);

  useEffect(() => {
    setIsPolling(hasProcessingFiles || false);
  }, [hasProcessingFiles]);

  const [fileToView, setFileToView] = useState<FileMetadata | null>(null);
  const { dynamicFileSize } = useFormatters();

  const fileTableColumns: Array<ColumnDef<FileMetadata>> = useMemo(
    () => [
      {
        header: t('table.columns.name'),
        accessorKey: 'file_name',
        cell: ({ row }) => {
          const file = row.original;

          return (
            <HStack align="center" gap="small">
              <Typography>
                {file.original_file_name || file.file_name}
              </Typography>
              {file.processing_status !== 'completed' && (
                <div style={{ marginLeft: '8px' }}>
                  <FileStatus file={file} />
                </div>
              )}
            </HStack>
          );
        },
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
        id: 'view',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        accessorKey: 'id',
        cell: ({ cell }) => (
          <HStack fullWidth justify="end">
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
              <DeleteFileModal
                sourceId={sourceId}
                fileId={cell.row.original.id || ''}
                trigger={
                  <DropdownMenuItem
                    doNotCloseOnSelect
                    label={t('deleteFile')}
                  />
                }
                fileName={cell.row.original.file_name || ''}
              />
            </DropdownMenu>
            <Button
              color="secondary"
              label={t('viewButton')}
              onClick={() => {
                setFileToView(cell.row.original);
              }}
            />
          </HStack>
        ),
      },
    ],
    [sourceId, t, dynamicFileSize],
  );

  return (
    <>
      <FileViewDialog
        file={fileToView || ({} as FileMetadata)}
        isOpen={!!fileToView}
        onClose={() => {
          setFileToView(null);
        }}
      />
      <DashboardPageLayout
        actions={
          <HStack>
            <UploadFileDialog limit={limit} />
            {source && (
              <DropdownMenu
                triggerAsChild
                align="end"
                trigger={
                  <Button
                    color="tertiary"
                    hideLabel
                    label={t('menuLabel')}
                    preIcon={<VerticalDotsIcon />}
                  />
                }
              >
                <UpdateSourceInstructionsModal
                  source={source}
                  trigger={
                    <DropdownMenuItem
                      doNotCloseOnSelect
                      preIcon={<ArticleIcon />}
                      label={t('editInstructions')}
                    />
                  }
                />
                <RenameDataSourceDialog
                  source={source}
                  trigger={
                    <DropdownMenuItem
                      doNotCloseOnSelect
                      preIcon={<EditIcon />}
                      label={t('rename')}
                    />
                  }
                />
                <DeleteDataSourceDialog
                  onSuccess={() => {
                    window.location.href = '/data-sources';
                  }}
                  trigger={
                    <DropdownMenuItem
                      doNotCloseOnSelect
                      preIcon={<TrashIcon />}
                      label={t('delete')}
                    />
                  }
                  source={source}
                />
              </DropdownMenu>
            )}
          </HStack>
        }
        returnButton={{
          href: '/data-sources',
          text: t('returnButtonText'),
        }}
        title={source?.name || ''}
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
