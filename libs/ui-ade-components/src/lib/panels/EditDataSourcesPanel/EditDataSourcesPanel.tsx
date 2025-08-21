'use client';
import { z } from 'zod';
import type { DialogTableItem } from '@letta-cloud/ui-component-library';
import { ArrowMenuOpenIcon } from '@letta-cloud/ui-component-library';
import { TextArea } from '@letta-cloud/ui-component-library';
import { Form, FormActions, Input } from '@letta-cloud/ui-component-library';
import {
  ActionCard,
  Alert,
  Badge,
  Button,
  DatabaseIcon,
  DatabaseUploadIcon,
  Dialog,
  DialogTable,
  FileIcon,
  FileTree,
  FormField,
  FormProvider,
  HStack,
  LettaLoader,
  PanelBar,
  PanelMainContent,
  PlusIcon,
  RawInput,
  SearchIcon,
  SingleFileUpload,
  StatusIndicatorOnIcon,
  Tooltip,
  TrashIcon,
  Typography,
  UploadIcon,
  useForm,
  VStack,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentState, Source } from '@letta-cloud/sdk-core';
import { isAPIError } from '@letta-cloud/sdk-core';
import {
  type ListSourceFilesResponse,
  useAgentsServiceAttachSourceToAgent,
  useAgentsServiceDetachSourceFromAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
  useJobsServiceListActiveJobs,
  UseJobsServiceListActiveJobsKeyFn,
  useSourcesServiceCreateSource,
  useSourcesServiceDeleteFileFromSource,
  useSourcesServiceListSourceFiles,
  UseSourcesServiceListSourceFilesKeyFn,
  useSourcesServiceListSources,
  useSourcesServiceModifySource,
  useSourcesServiceUploadFileToSource,
} from '@letta-cloud/sdk-core';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { get, isEqual } from 'lodash-es';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { BillingLink } from '@letta-cloud/ui-component-library';

interface AttachDataSourceActionProps {
  source: Source;
  isAttached: boolean;
  onAttach: VoidFunction;
}

function AttachDataSourceAction(props: AttachDataSourceActionProps) {
  const { source, onAttach, isAttached } = props;

  const { id, embedding_config } = useCurrentAgent();
  const queryClient = useQueryClient();

  const t = useTranslations('ADE/EditDataSourcesPanel');

  const { mutate, isPending } = useAgentsServiceAttachSourceToAgent({
    onSuccess: (response) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId: id,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            sources: [
              response,
              ...oldData.sources.filter(
                (currentSource) => currentSource.id !== response.id,
              ),
            ],
          };
        },
      );

      onAttach();
    },
  });

  const handleAttachSource = useCallback(
    (sourceId: string) => {
      mutate({
        agentId: id,
        sourceId,
      });
    },
    [id, mutate],
  );

  if (!isEqual(embedding_config, source.embedding_config)) {
    return (
      <Tooltip
        asChild
        content={t('AttachDataSourceView.notCompatible.details')}
      >
        <Button
          color="primary"
          size="small"
          disabled
          preIcon={<WarningIcon />}
          label={t('AttachDataSourceView.notCompatible.title')}
        />
      </Tooltip>
    );
  }

  return (
    <Button
      color="primary"
      type="button"
      disabled={isAttached}
      data-testid="attach-data-source-button"
      size="small"
      busy={isPending}
      onClick={() => {
        handleAttachSource(source.id || '');
      }}
      label={
        isAttached
          ? t('AttachDataSourceView.attached')
          : t('AttachDataSourceView.attach')
      }
    />
  );
}

interface AttachDataSourceViewProps {
  onClose: () => void;
  setMode: (mode: CreateDataSourceDialogMode) => void;
}

function AttachDataSourceView(props: AttachDataSourceViewProps) {
  const { sources: existingSources } = useCurrentAgent();
  const { onClose, setMode } = props;
  const { data: allSources } = useSourcesServiceListSources();

  const t = useTranslations('ADE/EditDataSourcesPanel');

  const existingSourcesIdSet = useMemo(() => {
    if (!existingSources) {
      return new Set<string>();
    }

    return new Set(existingSources.map((source) => source.id));
  }, [existingSources]);

  const [search, setSearch] = useState('');

  const sources: DialogTableItem[] = useMemo(() => {
    if (!allSources) {
      return [];
    }

    return allSources
      .filter((source) =>
        source.name.toLowerCase().includes(search.toLowerCase()),
      )
      .map((source) => {
        const isAttached = existingSourcesIdSet.has(source.id || '');

        return {
          icon: <DatabaseIcon />,
          label: source.name,
          action: (
            <AttachDataSourceAction
              isAttached={isAttached}
              onAttach={onClose}
              source={source}
            />
          ),
        };
      });
  }, [allSources, existingSourcesIdSet, onClose, search]);

  return (
    <VStack>
      <HStack>
        <RawInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          postIcon={<SearchIcon />}
          fullWidth
          hideLabel
          label={t('AttachDataSourceView.searchInput.label')}
          placeholder={t('AttachDataSourceView.searchInput.placeholder')}
        />
      </HStack>
      <DialogTable
        items={sources}
        emptyAction={
          !search && (
            <Button
              color="primary"
              size="small"
              label={t('AttachDataSourceView.emptyAction')}
              onClick={() => {
                setMode('create');
              }}
            />
          )
        }
        emptyMessage={
          search
            ? t('AttachDataSourceView.emptySearchMessage')
            : t('AttachDataSourceView.emptyMessage')
        }
        isLoading={!allSources}
      />
    </VStack>
  );
}

interface CreateNewDataSourceProps {
  onClose: () => void;
  setMode: (mode: CreateDataSourceDialogMode) => void;
}

const CreateNewDataSourceSchema = z.object({
  name: z.string().min(1),
  instructions: z.string().optional(),
});

type CreateNewDataSourceFormValues = z.infer<typeof CreateNewDataSourceSchema>;

function CreateNewDataSource(props: CreateNewDataSourceProps) {
  const { onClose, setMode } = props;

  const form = useForm<CreateNewDataSourceFormValues>({
    resolver: zodResolver(CreateNewDataSourceSchema),
    defaultValues: {
      name: '',
      instructions: '',
    },
  });

  const { mutate: attachDataSource, isPending: isAttachingDataSource } =
    useAgentsServiceAttachSourceToAgent();

  const {
    mutate: createDataSource,
    isPending: isCreatingDataSource,
    error,
  } = useSourcesServiceCreateSource();
  const queryClient = useQueryClient();
  const isPending = useMemo(() => {
    return isCreatingDataSource || isAttachingDataSource;
  }, [isCreatingDataSource, isAttachingDataSource]);

  const { id, embedding_config } = useCurrentAgent();

  const t = useTranslations('ADE/EditDataSourcesPanel');

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error) && error.status === 402) {
        return t.rich('CreateDataSourceDialog.errors.overage', {
          link: (chunks) => <BillingLink>{chunks}</BillingLink>,
        });
      }

      return t('CreateDataSourceDialog.errors.default');
    }

    return undefined;
  }, [error, t]);

  const handleCreateDataSource = useCallback(
    (values: CreateNewDataSourceFormValues) => {
      if (isPending) {
        return;
      }

      const { name, instructions } = values;

      createDataSource(
        {
          requestBody: {
            name,
            instructions,
            embedding_config,
          },
        },
        {
          onSuccess: (response) => {
            attachDataSource(
              {
                agentId: id,
                sourceId: response.id || '',
              },
              {
                onSuccess: () => {
                  queryClient.setQueriesData<AgentState | undefined>(
                    {
                      queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                        agentId: id,
                      }),
                    },
                    (oldData) => {
                      if (!oldData) {
                        return oldData;
                      }

                      return {
                        ...oldData,
                        sources: [
                          response,
                          ...oldData.sources.filter(
                            (currentSource) => currentSource.id !== response.id,
                          ),
                        ],
                      };
                    },
                  );

                  onClose();
                },
              },
            );
          },
        },
      );
    },
    [
      attachDataSource,
      createDataSource,
      embedding_config,
      id,
      isPending,
      onClose,
      queryClient,
    ],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleCreateDataSource)}>
        <VStack gap="form">
          <FormField
            render={({ field }) => (
              <Input
                fullWidth
                {...field}
                data-testid="create-data-source-dialog-name"
                label={t('CreateDataSourceDialog.name.label')}
                placeholder={t('CreateDataSourceDialog.name.placeholder')}
              />
            )}
            name="name"
          />
          <FormField
            render={({ field }) => (
              <TextArea
                autosize
                minRows={3}
                infoTooltip={{
                  text: t('CreateDataSourceDialog.instructions.details'),
                }}
                fullWidth
                {...field}
                label={t('CreateDataSourceDialog.instructions.label')}
                placeholder={t(
                  'CreateDataSourceDialog.instructions.placeholder',
                )}
              />
            )}
            name="instructions"
          />
          <FormActions errorMessage={errorMessage}>
            <Button
              color="tertiary"
              type="button"
              label={t('CreateDataSourceDialog.cancel')}
              onClick={() => {
                setMode(null);
              }}
            />
            <Button
              color="primary"
              data-testid="complete-create-data-source"
              type="submit"
              label={t('CreateDataSourceDialog.create')}
              busy={isPending}
            />
          </FormActions>
        </VStack>
      </Form>
    </FormProvider>
  );
}

type CreateDataSourceDialogMode = 'attach' | 'create' | null;

interface CreateDataSourceDialogInnerProps {
  mode: CreateDataSourceDialogMode;
  onClose: () => void;
  setMode: (mode: CreateDataSourceDialogMode) => void;
}

function CreateDataSourceDialogInner(props: CreateDataSourceDialogInnerProps) {
  const { mode, onClose, setMode } = props;
  const t = useTranslations('ADE/EditDataSourcesPanel');

  switch (mode) {
    case 'attach':
      return <AttachDataSourceView setMode={setMode} onClose={onClose} />;
    case 'create':
      return <CreateNewDataSource onClose={onClose} setMode={setMode} />;
    default:
      return (
        <VStack>
          <ActionCard
            testId="attach-existing-data-source"
            icon={<DatabaseUploadIcon />}
            onClick={() => {
              setMode('attach');
            }}
            title={t(
              'CreateDataSourceDialog.options.attachAnExistingDataSource.title',
            )}
            subtitle={t(
              'CreateDataSourceDialog.options.attachAnExistingDataSource.description',
            )}
          />
          <ActionCard
            testId="create-new-data-source"
            onClick={() => {
              setMode('create');
            }}
            icon={<DatabaseIcon />}
            title={t(
              'CreateDataSourceDialog.options.createANewDataSource.title',
            )}
            subtitle={t(
              'CreateDataSourceDialog.options.createANewDataSource.description',
            )}
          />
        </VStack>
      );
  }
}

function CreateDataSourceDialog() {
  const [open, setOpen] = useState(false);
  const t = useTranslations('ADE/EditDataSourcesPanel');
  const [mode, setMode] = useState<'attach' | 'create' | null>(null);

  const handleOpenChange = useCallback((state: boolean) => {
    setOpen(state);
    if (!state) {
      setMode(null);
    }
  }, []);

  return (
    <Dialog
      reverseButtons
      isOpen={open}
      onOpenChange={handleOpenChange}
      size="large"
      hideFooter
      disableForm
      hideConfirm={mode !== 'attach'}
      preventCloseFromOutside={mode === 'create'}
      confirmColor="tertiary"
      confirmText={t('CreateDataSourceDialog.goBack')}
      trigger={
        <Button
          preIcon={<PlusIcon />}
          color="secondary"
          hideLabel
          data-testid="create-data-source-dialog-trigger"
          label={t('CreateDataSourceDialog.trigger')}
        />
      }
      title={t('CreateDataSourceDialog.title')}
    >
      <VStack paddingBottom>
        <CreateDataSourceDialogInner
          mode={mode}
          onClose={() => {
            handleOpenChange(false);
          }}
          setMode={setMode}
        />
      </VStack>
    </Dialog>
  );
}

const uploadToFormValuesSchema = z.object({
  file: z.custom<File>((v) => v instanceof File),
});

type UploadToFormValues = z.infer<typeof uploadToFormValuesSchema>;

interface FileUploadDialogProps {
  sourceId: string;
  onClose: () => void;
}

function FileUploadDialog(props: FileUploadDialogProps) {
  const { sourceId, onClose } = props;

  const t = useTranslations('ADE/EditDataSourcesPanel');

  const handleOpenChange = useCallback(
    (state: boolean) => {
      if (!state) {
        onClose();
      }
    },
    [onClose],
  );

  const queryClient = useQueryClient();
  const { mutate, error, isPending } = useSourcesServiceUploadFileToSource({
    onSuccess: (_, variables) => {
      void queryClient.setQueriesData<ListSourceFilesResponse | undefined>(
        {
          queryKey: UseSourcesServiceListSourceFilesKeyFn({
            sourceId,
            limit: 1000,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return [
            {
              source_id: sourceId,
              user_id: '',
              file_name: (variables.formData.file as File).name || '',
            },
            ...oldData,
          ];
        },
      );

      void queryClient.invalidateQueries({
        queryKey: UseJobsServiceListActiveJobsKeyFn(),
      });

      onClose();
    },
  });

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error)) {
        if (error.body.errorCode === 'file_size_exceeded') {
          return t('FileUploadDialog.errors.fileSizeExceeded', {
            limit: error.body.limit || '5MB',
          });
        }

        if (error.body.errorCode === 'storage_exceeded') {
          return t('FileUploadDialog.errors.storageExceeded', {
            limit: error.body.limit || '5MB',
          });
        }
      }

      return t('FileUploadDialog.errors.genericError');
    }

    return undefined;
  }, [error, t]);

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
        sourceId: sourceId,
      });
    },
    [mutate, sourceId],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen
        errorMessage={errorMessage}
        onOpenChange={handleOpenChange}
        onSubmit={form.handleSubmit(onSubmit)}
        title={t('FileUploadDialog.title')}
        confirmText={t('FileUploadDialog.confirm')}
        isConfirmBusy={isPending}
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

interface DetachDataSourceConfirmDialogProps {
  sourceName: string;
  sourceId: string;
  onClose: () => void;
}

function DetachDataSourceConfirmDialog(
  props: DetachDataSourceConfirmDialogProps,
) {
  const { sourceName, sourceId, onClose } = props;
  const { id: agentId } = useCurrentAgent();
  const t = useTranslations('ADE/EditDataSourcesPanel');
  const queryClient = useQueryClient();

  const { isLocal } = useCurrentAgentMetaData();

  const {
    mutate: detachSource,
    isError,
    isPending,
  } = useAgentsServiceDetachSourceFromAgent({
    onSuccess: (_, variables: { agentId: string; sourceId: string }) => {
      if (isLocal) {
        trackClientSideEvent(AnalyticsEvent.LOCAL_AGENT_DATA_SOURCE_ATTACHED, {
          user_id: '',
        });
      } else {
        trackClientSideEvent(AnalyticsEvent.CLOUD_DATA_SOURCE_ATTACHED, {
          user_id: '',
        });
      }

      onClose();
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            sources: oldData.sources.filter(
              (currentSource) => currentSource.id !== variables.sourceId,
            ),
          };
        },
      );
    },
  });

  const handleDetach = useCallback(() => {
    detachSource({
      agentId,
      sourceId: sourceId,
    });
  }, [detachSource, agentId, sourceId]);

  return (
    <Dialog
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
      isOpen
      testId="detach-data-source-dialog"
      title={t('DetachDataSourceConfirmDialog.title', { sourceName })}
      confirmText={t('DetachDataSourceConfirmDialog.confirm')}
      isConfirmBusy={isPending}
      onConfirm={handleDetach}
      errorMessage={
        isError ? t('DetachDataSourceConfirmDialog.error') : undefined
      }
    >
      <Typography>
        {t('DetachDataSourceConfirmDialog.areYouSure', { sourceName })}
      </Typography>
    </Dialog>
  );
}

export interface DeleteFilePayload {
  sourceId: string;
  fileId: string;

  fileName: string;
}

interface DeleteFileDialogProps extends DeleteFilePayload {
  onClose: () => void;
  limit?: number;
}

export function DeleteFileDialog(props: DeleteFileDialogProps) {
  const queryClient = useQueryClient();
  const { sourceId, fileId, fileName, limit, onClose } = props;
  const t = useTranslations('ADE/EditDataSourcesPanel');

  const { mutate, isPending, isError } = useSourcesServiceDeleteFileFromSource({
    onSuccess: () => {
      onClose();
      queryClient.setQueriesData<ListSourceFilesResponse | undefined>(
        {
          queryKey: UseSourcesServiceListSourceFilesKeyFn({
            sourceId,
            limit,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return oldData.filter((file) => file.id !== fileId);
        },
      );
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
      isOpen
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
      title={t('DeleteFileDialog.title', { fileName })}
      confirmText={t('DeleteFileDialog.confirm')}
      isConfirmBusy={isPending}
      onConfirm={handleDelete}
      errorMessage={isError ? t('DeleteFileDialog.error') : undefined}
    >
      <Typography>{t('DeleteFileDialog.areYouSure', { fileName })}</Typography>
    </Dialog>
  );
}

const UpdateDataSourceInstructionsSchema = z.object({
  instructions: z.string().optional(),
});

type UpdateDataSourceInstructionsFormValues = z.infer<
  typeof UpdateDataSourceInstructionsSchema
>;

interface UpdateDataSourceInstructionsDialogProps {
  source: Source;
  onClose: () => void;
}

function UpdateDataSourceInstructionsDialog(
  props: UpdateDataSourceInstructionsDialogProps,
) {
  const { source, onClose } = props;
  const t = useTranslations('ADE/EditDataSourcesPanel');

  const queryClient = useQueryClient();
  const { id: agentId } = useCurrentAgent();

  const form = useForm<UpdateDataSourceInstructionsFormValues>({
    resolver: zodResolver(UpdateDataSourceInstructionsSchema),
    defaultValues: {
      instructions: source.instructions || '',
    },
  });

  const { mutate, isPending, isError } = useSourcesServiceModifySource({
    onSuccess: (response) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            sources: oldData.sources.map((currentSource) => {
              if (currentSource.id === source.id) {
                return {
                  ...currentSource,
                  description: response.description,
                };
              }

              return currentSource;
            }),
          };
        },
      );

      onClose();
    },
  });

  const onSubmit = useCallback(
    (values: UpdateDataSourceInstructionsFormValues) => {
      mutate({
        sourceId: source.id || '',
        requestBody: {
          instructions: values.instructions,
        },
      });
    },
    [mutate, source.id],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={
          isError ? t('UpdateDataSourceInstructionsDialog.error') : undefined
        }
        isOpen
        onOpenChange={(state) => {
          if (!state) {
            onClose();
          }
        }}
        onSubmit={form.handleSubmit(onSubmit)}
        title={t('UpdateDataSourceInstructionsDialog.title')}
        confirmText={t('UpdateDataSourceInstructionsDialog.confirm')}
        isConfirmBusy={isPending}
      >
        <FormField
          render={({ field }) => (
            <TextArea
              autosize
              minRows={3}
              fullWidth
              {...field}
              label={t('UpdateDataSourceInstructionsDialog.instructions.label')}
              placeholder={t(
                'UpdateDataSourceInstructionsDialog.instructions.placeholder',
              )}
            />
          )}
          name="instructions"
        />
      </Dialog>
    </FormProvider>
  );
}

interface DeleteDataSourceDialogProps {
  source: Source;
  onClose: () => void;
}

function DeleteDataSourceDialog(props: DeleteDataSourceDialogProps) {
  const { source, onClose } = props;
  const t = useTranslations('ADE/EditDataSourcesPanel');

  const queryClient = useQueryClient();

  const { id: agentId } = useCurrentAgent();

  const deleteDataSourceSchema = z.object({
    confirmName: z.string().refine((value) => value === source.name, {
      message: t('DeleteDataSourceDialog.confirmName.error'),
    }),
  });

  type DeleteDataSourceFormValues = z.infer<typeof deleteDataSourceSchema>;

  const form = useForm<DeleteDataSourceFormValues>({
    resolver: zodResolver(deleteDataSourceSchema),
    defaultValues: {
      confirmName: '',
    },
  });

  const { mutate, isPending, isError } = useAgentsServiceDetachSourceFromAgent({
    onSuccess: () => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            sources: oldData.sources.filter(
              (currentSource) => currentSource.id !== source.id,
            ),
          };
        },
      );
      onClose();
    },
  });

  const onSubmit = useCallback(() => {
    mutate({
      agentId,
      sourceId: source.id || '',
    });
  }, [mutate, source.id, agentId]);

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={isError ? t('DeleteDataSourceDialog.error') : undefined}
        isOpen
        onOpenChange={(state) => {
          if (!state) {
            onClose();
          }
        }}
        onSubmit={form.handleSubmit(onSubmit)}
        title={t('DeleteDataSourceDialog.title')}
        confirmText={t('DeleteDataSourceDialog.confirm')}
        isConfirmBusy={isPending}
      >
        <Alert
          title={t('DeleteDataSourceDialog.description', {
            sourceName: source.name,
          })}
          variant="destructive"
        ></Alert>
        <FormField
          render={({ field }) => (
            <RawInput
              fullWidth
              {...field}
              label={t('DeleteDataSourceDialog.confirmName.label')}
            />
          )}
          name="confirmName"
        />
      </Dialog>
    </FormProvider>
  );
}

interface RenameDataSourceDialogProps {
  source: Source;
  onClose: () => void;
}

const renameDataSourceSchema = z.object({
  name: z.string(),
});

type RenameDataSourceFormValues = z.infer<typeof renameDataSourceSchema>;

function RenameDataSourceDialog(props: RenameDataSourceDialogProps) {
  const { source, onClose } = props;
  const t = useTranslations('ADE/EditDataSourcesPanel');

  const queryClient = useQueryClient();
  const { id: agentId } = useCurrentAgent();

  const form = useForm<RenameDataSourceFormValues>({
    resolver: zodResolver(renameDataSourceSchema),
    defaultValues: {
      name: source.name,
    },
  });

  const { mutate, isPending, isError } = useSourcesServiceModifySource({
    onSuccess: (response) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            sources: oldData.sources.map((currentSource) => {
              if (currentSource.id === source.id) {
                return {
                  ...currentSource,
                  name: response.name,
                };
              }

              return currentSource;
            }),
          };
        },
      );

      onClose();
    },
  });

  const onSubmit = useCallback(
    (values: RenameDataSourceFormValues) => {
      mutate({
        sourceId: source.id || '',
        requestBody: {
          name: values.name,
        },
      });
    },
    [mutate, source.id],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={
          isError ? t('RenameDataSourceDialog.errors.default') : undefined
        }
        isOpen
        onOpenChange={(state) => {
          if (!state) {
            onClose();
          }
        }}
        onSubmit={form.handleSubmit(onSubmit)}
        title={t('RenameDataSourceDialog.title')}
        confirmText={t('RenameDataSourceDialog.confirm')}
        isConfirmBusy={isPending}
      >
        <FormField
          render={({ field }) => (
            <RawInput
              fullWidth
              {...field}
              hideLabel
              label={t('RenameDataSourceDialog.name.label')}
              placeholder={t('RenameDataSourceDialog.name.placeholder')}
            />
          )}
          name="name"
        />
      </Dialog>
    </FormProvider>
  );
}

interface EditDataSourcesContentProps {
  search: string;
}

function EditDataSourcesContent(props: EditDataSourcesContentProps) {
  const { embedding_config: agentEmbeddingConfig } = useCurrentAgent();
  const t = useTranslations('ADE/EditDataSourcesPanel');
  const [sourceToDetach, setSourceToDetach] = useState<Source | null>(null);
  const [sourceToRename, setSourceToRename] = useState<Source | null>(null);
  const [sourceToUpdateInstructions, setSourceToUpdateInstructions] =
    useState<Source | null>(null);
  const [sourceToDelete, setSourceToDelete] = useState<Source | null>(null);
  const [fileToDelete, setFileToDelete] = useState<Omit<
    DeleteFilePayload,
    'onClose'
  > | null>(null);

  const { search } = props;
  const { sources } = useCurrentAgent();

  const { data } = useJobsServiceListActiveJobs(undefined, undefined, {
    refetchInterval: 3000,
  });

  const sourceIdsBeingProcessedSet = useMemo(() => {
    if (!data) {
      return new Set<string>();
    }

    return new Set(
      data.map((job) => get(job.metadata, 'source_id')).filter(Boolean),
    );
  }, [data]);

  const fileIdsBeingProcessedSet = useMemo(() => {
    if (!data) {
      return new Set<string>();
    }

    return new Set(
      data.map((job) => get(job.metadata, 'file_id')).filter(Boolean),
    );
  }, [data]);

  const [sourceIdToUploadFileTo, setSourceIdToUploadFileTo] = useState<
    string | null
  >(null);

  const filteredSources = useMemo(() => {
    if (!sources) {
      return [];
    }

    return sources
      .filter((source) => {
        return source.name.toLowerCase().includes(search.toLowerCase());
      })
      .map((source) => {
        const icon = (
          <StatusIndicatorOnIcon
            label={t('EditDataSourcesContent.processing')}
            icon={<DatabaseIcon />}
            status={
              sourceIdsBeingProcessedSet.has(source.id)
                ? 'processing'
                : undefined
            }
          />
        );

        const isCompatible = isEqual(
          source.embedding_config,
          agentEmbeddingConfig,
        );

        return {
          badge: !isCompatible && (
            <Tooltip
              content={t('EditDataSourcesContent.notCompatible.details')}
            >
              <Badge
                preIcon={<WarningIcon />}
                content={t('EditDataSourcesContent.notCompatible.title')}
                variant="warning"
              />
            </Tooltip>
          ),
          name: source.name,
          icon,
          openIcon: icon,
          actions: [
            {
              id: 'detach',
              label: t('EditDataSourcesContent.detachSource'),
              onClick: () => {
                setSourceToDetach(source);
              },
            },
            {
              id: 'rename',
              label: t('RenameDataSourceDialog.trigger'),
              onClick: () => {
                setSourceToRename(source);
              },
            },
            {
              id: 'updateInstructions',
              label: t('UpdateDataSourceInstructionsDialog.trigger'),
              onClick: () => {
                setSourceToUpdateInstructions(source);
              },
            },
            {
              id: 'delete',
              color: 'destructive',
              label: t('DeleteDataSourceDialog.trigger'),
              onClick: () => {
                setSourceToDelete(source);
              },
            },
          ],
          useContents: () => {
            const { data, isLoading } = useSourcesServiceListSourceFiles({
              limit: 1000,
              sourceId: source.id || '',
            });

            const files = useMemo(() => {
              return [
                ...(data || []).map((file) => {
                  return {
                    name: file.file_name,
                    icon: (
                      <StatusIndicatorOnIcon
                        label={t('EditDataSourcesContent.processing')}
                        icon={<FileIcon />}
                        status={
                          fileIdsBeingProcessedSet.has(file.id)
                            ? 'processing'
                            : undefined
                        }
                      />
                    ),
                    actions: [
                      {
                        icon: <TrashIcon />,
                        label: t('EditDataSourcesContent.delete'),
                        onClick: () => {
                          setFileToDelete({
                            sourceId: source.id || '',
                            fileId: file.id || '',
                            fileName: file.file_name || '',
                          });
                        },
                      },
                    ],
                  };
                }),
                {
                  name: t('EditDataSourcesContent.viewJobs'),
                  onClick: () => {
                    window.open(`/data-sources/${source.id}/jobs`, '_blank');
                  },
                  icon: <ArrowMenuOpenIcon />,
                },
                {
                  name: t('EditDataSourcesContent.uploadFile'),
                  onClick: () => {
                    setSourceIdToUploadFileTo(source.id || '');
                  },
                  icon: <UploadIcon />,
                },
              ];
            }, [data]);

            return {
              isLoading,
              data: files,
            };
          },
        };
      });
  }, [
    sources,
    search,
    t,
    sourceIdsBeingProcessedSet,
    agentEmbeddingConfig,
    fileIdsBeingProcessedSet,
  ]);

  if (!sources) {
    return (
      <HStack fullWidth align="center">
        <LettaLoader size="small" />
        <Typography>{t('loading')}</Typography>
      </HStack>
    );
  }

  if (!filteredSources.length) {
    return (
      <HStack fullWidth>
        <Alert variant="info" title={t('noDataSources')} />
      </HStack>
    );
  }

  return (
    <>
      {sourceToDelete && (
        <DeleteDataSourceDialog
          source={sourceToDelete}
          onClose={() => {
            setSourceToDelete(null);
          }}
        />
      )}
      {sourceToRename && (
        <RenameDataSourceDialog
          source={sourceToRename}
          onClose={() => {
            setSourceToRename(null);
          }}
        />
      )}
      {fileToDelete && (
        <DeleteFileDialog
          limit={1000}
          sourceId={fileToDelete.sourceId}
          fileId={fileToDelete.fileId}
          fileName={fileToDelete.fileName}
          onClose={() => {
            setFileToDelete(null);
          }}
        />
      )}
      {sourceToDetach && (
        <DetachDataSourceConfirmDialog
          sourceName={sourceToDetach.name}
          sourceId={sourceToDetach.id || ''}
          onClose={() => {
            setSourceToDetach(null);
          }}
        />
      )}
      {sourceIdToUploadFileTo && (
        <FileUploadDialog
          sourceId={sourceIdToUploadFileTo}
          onClose={() => {
            setSourceIdToUploadFileTo(null);
          }}
        />
      )}
      {sourceToUpdateInstructions && (
        <UpdateDataSourceInstructionsDialog
          source={sourceToUpdateInstructions}
          onClose={() => {
            setSourceToUpdateInstructions(null);
          }}
        />
      )}
      <FileTree root={filteredSources} />
    </>
  );
}

export function EditDataSourcesPanel() {
  const [search, setSearch] = useState('');
  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  return (
    <VStack fullHeight gap={false}>
      <PanelBar
        searchValue={search}
        onSearch={setSearch}
        actions={canUpdateAgent && <CreateDataSourceDialog />}
      ></PanelBar>
      <PanelMainContent>
        <EditDataSourcesContent search={search} />
      </PanelMainContent>
    </VStack>
  );
}

export function useDataSourcesTitle() {
  const t = useTranslations('ADE/EditDataSourcesPanel');
  const { sources } = useCurrentAgent();

  const count = useMemo(() => {
    if (!sources) {
      return '-';
    }

    return sources.length || 0;
  }, [sources]);

  return t('title', { count });
}
