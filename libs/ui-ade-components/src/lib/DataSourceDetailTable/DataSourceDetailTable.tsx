'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  DesktopPageLayout,
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
  DatabaseIcon,
  toast,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { FileMetadata } from '@letta-cloud/sdk-core';
import { useSourcesServiceRetrieveSource } from '@letta-cloud/sdk-core';
import {
  UseJobsServiceListActiveJobsKeyFn,
  UseSourcesServiceListSourceFilesKeyFn,
  useSourcesServiceUploadFileToSource,
  useSourcesServiceGetFileMetadata,
  useSourcesServiceListSourceFiles,
} from '@letta-cloud/sdk-core';
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { DeleteFileModal } from '../ade/panels/DataSourcesV2/_components/DeleteFileModal/DeleteFileModal';
import { FileStatus } from '../ade/panels/DataSourcesV2/_components/DataSourceView/FilesView/FileView/FileStatus';
import { useFormatters } from '@letta-cloud/utils-client';
import { DeleteDataSourceDialog } from '../ade/panels/DataSourcesV2/_components/DeleteDatasourceDialog/DeleteDatasourceDialog';
import { RenameDataSourceDialog } from '../ade/panels/DataSourcesV2/_components/RenameDataSourceDialog/RenameDataSourceDialog';
import { UpdateSourceInstructionsModal } from '../ade/panels/DataSourcesV2/_components/UpdateSourceInstructionsModal/UpdateSourceInstructionsModal';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

const uploadToFormValuesSchema = z.object({
  files: z.array(z.custom<File>((v) => v instanceof File)),
});

type UploadToFormValues = z.infer<typeof uploadToFormValuesSchema>;

interface UploadFileDialogProps {
  dataSourceId: string;
  limit: number;
  isDesktop?: boolean;
  canUpload?: boolean;
}

function UploadFileDialog({
  dataSourceId,
  limit,
  isDesktop,
  canUpload = true,
}: UploadFileDialogProps) {
  const t = useTranslations('DataSourceDetailTable');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fileErrorMessage, setFileErrorMessage] = useState<string>('');

  // Get billing tier for usage limits with fallback for different environments
  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
      retry: false,
      enabled: !isDesktop, // TODO: detect billing tier for desktop
    });

  const billingTier = useMemo(() => {
    return billingData?.body.billingTier || 'free';
  }, [billingData?.body.billingTier]);

  const limits = useMemo(() => getUsageLimits(billingTier), [billingTier]);

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
      form.clearErrors('files');

      if (values.files.length === 0) {
        return;
      }

      const errors: string[] = [];
      const successMessage: string[] = [t('success.uploadedFile')];

      const failedFiles: File[] = [];

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
                  successMessage.push(file.name);
                  resolve();
                },
                onError: (error) => {
                  reject(error);
                },
              },
            );
          });
        } catch (error) {
          console.error(t('errors.failedToUpload'), error);
          const errorMessage =
            error instanceof Error ? error.message : t('errors.unknownError');
          errors.push(` ${file.name}: ${errorMessage}`);
          failedFiles.push(file);
        }
      }

      form.setValue('files', failedFiles);
      if (successMessage.length > 1) {
        toast.success(successMessage.join('\n'));
      }

      if (errors.length === 0) {
        void queryClient.invalidateQueries({
          queryKey: UseJobsServiceListActiveJobsKeyFn(),
        });
        form.reset({ files: [] });
        setIsDialogOpen(false);
        return;
      }

      // If there were errors, set them on the form and don't close dialog
      form.setError('files', {
        type: 'manual',
        message: errors.join('\n'),
      });
      setIsDialogOpen(true);
    },
    [dataSourceId, mutate, queryClient, form, t],
  );

  if (!canUpload) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            form.reset({ files: [] });
            setFileErrorMessage('');
          }
        }}
        isOpen={isDialogOpen}
        onSubmit={form.handleSubmit(onSubmit)}
        title={t('uploadDialog.title')}
        confirmText={t('uploadDialog.confirmText')}
        isConfirmBusy={isPending}
        disableSubmit={fileErrorMessage.length > 0}
        trigger={
          <Button
            label={t('uploadDialog.triggerLabel')}
            preIcon={<UploadIcon />}
            size={isDesktop ? 'small' : undefined}
          />
        }
      >
        <VStack fullWidth gap="small">
          <FormField
            render={({ field }) => (
              <MultiFileUpload
                fullWidth
                {...field}
                hideLabel
                label="files"
                maxFiles={10}
                maxSizePerFile={limits.fileSize}
                onFileErrorsChange={(hasErrors) => {
                  if (hasErrors) {
                    setFileErrorMessage(t('uploadDialog.fileErrorMessage'));
                  } else {
                    setFileErrorMessage('');
                  }
                }}
              />
            )}
            name="files"
          />
          {fileErrorMessage && (
            <Typography variant="body2" color="destructive">
              {fileErrorMessage}
            </Typography>
          )}
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

interface FileStatsProps {
  file: FileMetadata;
  isDesktop?: boolean;
}

function FileStats({ file, isDesktop }: FileStatsProps) {
  const t = useTranslations('DataSourceDetailTable');
  const { file_name, file_size } = file;

  const fileTypeName = useMemo(() => {
    const parts = (file_name || '').split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toUpperCase();
    }
    return isDesktop ? 'FILE' : t('fileType.defaultType');
  }, [file_name, t, isDesktop]);

  let formatFileSize: (size: number) => string;
  try {
    const formatters = useFormatters();
    formatFileSize = formatters.dynamicFileSize;
  } catch {
    formatFileSize = (size: number) => {
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };
  }

  return (
    <HStack gap="medium" align="center">
      <HStack gap="small">
        <ArticleIcon color="lighter" />
        <Typography color="lighter" variant="body2">
          {fileTypeName}
        </Typography>
      </HStack>

      <Typography color="lighter" variant="body2">
        {formatFileSize(file_size || 0)}
      </Typography>
    </HStack>
  );
}

interface FileViewDialogProps {
  file: FileMetadata;
  isOpen: boolean;
  onClose: () => void;
  isDesktop?: boolean;
}

function FileViewDialog({
  file,
  isOpen,
  onClose,
  isDesktop,
}: FileViewDialogProps) {
  const t = useTranslations('DataSourceDetailTable');
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
        (isDesktop ? 'Untitled' : t('fileType.untitled'))
      );
    }
    return isDesktop ? 'Untitled' : t('fileType.untitled');
  }, [file.file_name, t, isDesktop]);

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
          <FileStats file={file} isDesktop={isDesktop} />
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
              <Typography italic>
                {isDesktop
                  ? 'No content available'
                  : t('fileContent.noContent')}
              </Typography>
            )
          ) : (
            <LoadingEmptyStatusComponent
              isLoading
              loadingMessage={
                isDesktop ? 'Loading...' : t('fileContent.loading')
              }
            />
          )}
        </HStack>
      </VStack>
    </Dialog>
  );
}

interface DataSourceDetailTableProps {
  dataSourceId: string;
  isDesktop?: boolean;
  onNavigateBack?: () => void;
  canUpload?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  returnButton?: {
    href: string;
    text: string;
  };
}

export function DataSourceDetailTable({
  dataSourceId,
  isDesktop = false,
  onNavigateBack,
  canUpload = true,
  canUpdate = true,
  canDelete = true,
  returnButton,
}: DataSourceDetailTableProps) {
  const t = useTranslations('DataSourceDetailTable');
  const [limit, setLimit] = useState<number>(0);
  const [cursor, setCursor] = useState<FileMetadata | undefined>(undefined);

  const { data: source } = useSourcesServiceRetrieveSource({
    sourceId: dataSourceId,
  });

  const [isPolling, setIsPolling] = useState(false);

  const { data: files, isError } = useSourcesServiceListSourceFiles(
    {
      sourceId: dataSourceId,
      limit,
      after: cursor?.id,
    },
    undefined,
    {
      enabled: limit > 0 && !!dataSourceId,
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

  let formatFileSize: (size: number) => string;
  try {
    const formatters = useFormatters();
    formatFileSize = formatters.dynamicFileSize;
  } catch {
    formatFileSize = (size: number) => {
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };
  }

  const fileTableColumns: Array<ColumnDef<FileMetadata>> = useMemo(
    () => [
      {
        header: isDesktop ? 'Name' : t('table.columns.name'),
        accessorKey: 'file_name',
        cell: ({ row }) => {
          const file = row.original;

          return (
            <HStack align="center" gap="small">
              <Typography>
                {file.original_file_name || file.file_name}
              </Typography>
              {!isDesktop && file.processing_status !== 'completed' && (
                <div style={{ marginLeft: '8px' }}>
                  <FileStatus file={file} />
                </div>
              )}
            </HStack>
          );
        },
      },
      {
        header: isDesktop ? 'File Size' : t('table.columns.fileSize'),
        accessorKey: 'file_size',
        cell: ({ row }) => {
          return (
            <Typography>
              {formatFileSize(row.original.file_size || 0)}
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
                  label={isDesktop ? 'Actions' : t('actions')}
                  hideLabel
                  preIcon={<DotsHorizontalIcon />}
                  color="tertiary"
                />
              }
            >
              <DeleteFileModal
                sourceId={dataSourceId}
                fileId={cell.row.original.id || ''}
                fileName={cell.row.original.file_name || ''}
                limit={limit}
                trigger={
                  <DropdownMenuItem
                    doNotCloseOnSelect
                    label={isDesktop ? 'Delete' : t('deleteFile')}
                  />
                }
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
            label={isDesktop ? 'View' : t('viewButton')}
            onClick={() => {
              setFileToView(cell.row.original);
            }}
          />
        ),
      },
    ],
    [dataSourceId, limit, t, formatFileSize, isDesktop],
  );

  const handleDeleteSuccess = useCallback(() => {
    if (onNavigateBack) {
      onNavigateBack();
    } else if (isDesktop) {
      window.history.back();
    } else {
      window.location.href = '/data-sources';
    }
  }, [onNavigateBack, isDesktop]);

  const defaultReturnButton = !isDesktop
    ? {
        href: '/data-sources',
        text: t('returnButtonText'),
      }
    : undefined;

  const finalReturnButton = returnButton || defaultReturnButton;

  if (!dataSourceId) {
    return null;
  }

  const actions = (
    <HStack>
      <UploadFileDialog
        dataSourceId={dataSourceId}
        limit={limit}
        isDesktop={isDesktop}
        canUpload={canUpload}
      />
      {source && (
        <DropdownMenu
          triggerAsChild
          align="end"
          trigger={
            <Button
              color="tertiary"
              hideLabel
              label={isDesktop ? 'Menu' : t('menuLabel')}
              preIcon={<VerticalDotsIcon />}
            />
          }
        >
          {canUpdate && (
            <>
              <UpdateSourceInstructionsModal
                source={source}
                trigger={
                  <DropdownMenuItem
                    doNotCloseOnSelect
                    preIcon={<ArticleIcon />}
                    label={
                      isDesktop ? 'Edit Instructions' : t('editInstructions')
                    }
                  />
                }
              />
              <RenameDataSourceDialog
                source={source}
                trigger={
                  <DropdownMenuItem
                    doNotCloseOnSelect
                    preIcon={<EditIcon />}
                    label={isDesktop ? 'Rename' : t('rename')}
                  />
                }
              />
            </>
          )}
          {canDelete && (
            <DeleteDataSourceDialog
              onSuccess={handleDeleteSuccess}
              trigger={
                <DropdownMenuItem
                  doNotCloseOnSelect
                  preIcon={<TrashIcon />}
                  label={isDesktop ? 'Delete' : t('delete')}
                />
              }
              source={source}
            />
          )}
        </DropdownMenu>
      )}
    </HStack>
  );

  const desktopContent = (
    <VStack
      fullWidth
      fullHeight
      paddingX="small"
      paddingTop="small"
      justify="center"
    >
      <DataTable
        columns={fileTableColumns}
        data={files || []}
        isLoading={!files}
        autofitHeight
        onSetCursor={setCursor}
        onLimitChange={setLimit}
        noResultsText={'This data source has no files'}
        errorMessage={isError ? 'Error loading files' : ''}
      />
    </VStack>
  );

  return (
    <>
      <FileViewDialog
        file={fileToView || ({} as FileMetadata)}
        isOpen={!!fileToView}
        onClose={() => {
          setFileToView(null);
        }}
        isDesktop={isDesktop}
      />

      {isDesktop ? (
        <DesktopPageLayout
          icon={<DatabaseIcon />}
          title={source?.name || 'Data Source'}
          subtitle={'Files'}
          actions={actions}
        >
          {desktopContent}
        </DesktopPageLayout>
      ) : (
        <DashboardPageLayout
          actions={actions}
          title={source?.name || t('title')}
          returnButton={
            finalReturnButton &&
            finalReturnButton.href &&
            finalReturnButton.text
              ? finalReturnButton
              : undefined
          }
          encapsulatedFullHeight
        >
          <DashboardPageSection fullHeight>
            <DataTable
              columns={fileTableColumns}
              data={files || []}
              isLoading={!files}
              autofitHeight
              showPagination
              onSetCursor={setCursor}
              onLimitChange={setLimit}
              noResultsText={t('emptyMessage')}
              errorMessage={isError ? t('emptyMessage') : ''}
            />
          </DashboardPageSection>
        </DashboardPageLayout>
      )}
    </>
  );
}
