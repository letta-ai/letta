import { z } from 'zod';
import type {
  DialogTableItem,
  PanelTemplate,
} from '@letta-web/component-library';
import { StatusIndicatorOnIcon } from '@letta-web/component-library';
import {
  ActionCard,
  Alert,
  FileIcon,
  UploadIcon,
  FileTree,
  FormField,
  FormProvider,
  LettaLoader,
  LoadingEmptyStatusComponent,
  PanelMainContent,
  PlusIcon,
  SingleFileUpload,
  TrashIcon,
  Typography,
  SearchIcon,
  useForm,
} from '@letta-web/component-library';
import { Dialog, DialogTable, RawInput } from '@letta-web/component-library';
import { Button, HStack, PanelBar } from '@letta-web/component-library';
import { VStack } from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Source } from '@letta-web/letta-agents-api';
import {
  type AgentsServiceGetAgentSourcesDefaultResponse,
  type ListFilesFromSourceResponse,
  useAgentsServiceGetAgentSources,
  UseAgentsServiceGetAgentSourcesKeyFn,
  useJobsServiceListActiveJobs,
  UseJobsServiceListActiveJobsKeyFn,
  useSourcesServiceAttachAgentToSource,
  useSourcesServiceCreateSource,
  useSourcesServiceDeleteFileFromSource,
  useSourcesServiceDetachAgentFromSource,
  useSourcesServiceListFilesFromSource,
  UseSourcesServiceListFilesFromSourceKeyFn,
  useSourcesServiceListSources,
  useSourcesServiceUploadFileToSource,
} from '@letta-web/letta-agents-api';
import { useCurrentAgent } from '../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { DatabaseIcon, DatabaseUploadIcon } from '@letta-web/component-library';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { zodResolver } from '@hookform/resolvers/zod';
import { get } from 'lodash-es';

interface AttachDataSourceViewProps {
  onClose: () => void;
  setMode: (mode: CreateDataSourceDialogMode) => void;
}

function AttachDataSourceView(props: AttachDataSourceViewProps) {
  const { id } = useCurrentAgent();
  const { onClose, setMode } = props;
  const { data: allSources } = useSourcesServiceListSources();

  const queryClient = useQueryClient();

  const t = useTranslations('ADE/ADESidebar');

  const { mutate, isPending } = useSourcesServiceAttachAgentToSource({
    onSuccess: (_, variables) => {
      const newSource = allSources?.find(
        (source) => source.id === variables.sourceId
      );

      if (!newSource) {
        return;
      }

      queryClient.setQueriesData<
        AgentsServiceGetAgentSourcesDefaultResponse | undefined
      >(
        {
          queryKey: UseAgentsServiceGetAgentSourcesKeyFn({
            agentId: id,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return [newSource, ...oldData];
        }
      );

      onClose();
    },
  });

  const { data: existingSources } = useAgentsServiceGetAgentSources({
    agentId: id,
  });

  const existingSourcesIdSet = useMemo(() => {
    if (!existingSources) {
      return new Set<string>();
    }

    return new Set(existingSources.map((source) => source.id));
  }, [existingSources]);

  const handleAttachSource = useCallback(
    (sourceId: string) => {
      mutate({
        agentId: id,
        sourceId,
      });
    },
    [id, mutate]
  );

  const [search, setSearch] = useState('');

  const sources: DialogTableItem[] = useMemo(() => {
    if (!allSources) {
      return [];
    }

    return allSources
      .filter((source) =>
        source.name.toLowerCase().includes(search.toLowerCase())
      )
      .map((source) => {
        const isAttached = existingSourcesIdSet.has(source.id || '');

        return {
          icon: <DatabaseIcon />,
          label: source.name,
          action: (
            <Button
              color="primary"
              type="button"
              disabled={isAttached}
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
          ),
        };
      });
  }, [
    allSources,
    existingSourcesIdSet,
    handleAttachSource,
    isPending,
    search,
    t,
  ]);

  return (
    <VStack>
      <HStack>
        <RawInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          preIcon={<SearchIcon />}
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

type CreateDataSourceDialogMode = 'attach' | 'create' | null;

interface CreateDataSourceDialogInnerProps {
  mode: CreateDataSourceDialogMode;
  onClose: () => void;
  setMode: (mode: CreateDataSourceDialogMode) => void;
}

function CreateDataSourceDialogInner(props: CreateDataSourceDialogInnerProps) {
  const { mode, onClose, setMode } = props;
  const t = useTranslations('ADE/EditDataSourcesPanel');
  const { id } = useCurrentAgent();

  const { mutate: createDataSource, isPending: isCreatingDataSource } =
    useSourcesServiceCreateSource();
  const { mutate: attachDataSource, isPending: isAttachingDataSource } =
    useSourcesServiceAttachAgentToSource();
  const queryClient = useQueryClient();
  const isPending = useMemo(() => {
    return isCreatingDataSource || isAttachingDataSource;
  }, [isCreatingDataSource, isAttachingDataSource]);

  const handleCreateDataSource = useCallback(() => {
    if (isPending) {
      return;
    }

    const randomName = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      length: 3,
      separator: '-',
    });

    createDataSource(
      {
        requestBody: {
          name: randomName,
          description: '',
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
                queryClient.setQueriesData<
                  AgentsServiceGetAgentSourcesDefaultResponse | undefined
                >(
                  {
                    queryKey: UseAgentsServiceGetAgentSourcesKeyFn({
                      agentId: id,
                    }),
                  },
                  (oldData) => {
                    if (!oldData) {
                      return oldData;
                    }

                    return [response, ...oldData];
                  }
                );

                onClose();
              },
            }
          );
        },
      }
    );
  }, [attachDataSource, createDataSource, id, isPending, onClose, queryClient]);

  switch (mode) {
    case 'attach':
      return <AttachDataSourceView setMode={setMode} onClose={onClose} />;
    case 'create':
      return (
        <LoadingEmptyStatusComponent
          emptyMessage=""
          isLoading
          loadingMessage={t('CreateDataSourceDialog.creatingDataSource')}
        />
      );
    default:
      return (
        <VStack>
          <ActionCard
            icon={<DatabaseUploadIcon />}
            onCardClick={() => {
              setMode('attach');
            }}
            title={t(
              'CreateDataSourceDialog.options.attachAnExistingDataSource.title'
            )}
            subtitle={t(
              'CreateDataSourceDialog.options.attachAnExistingDataSource.description'
            )}
          />
          <ActionCard
            onCardClick={() => {
              setMode('create');
              handleCreateDataSource();
            }}
            icon={<DatabaseIcon />}
            title={t(
              'CreateDataSourceDialog.options.createANewDataSource.title'
            )}
            subtitle={t(
              'CreateDataSourceDialog.options.createANewDataSource.description'
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
      hideConfirm={mode !== 'attach'}
      preventCloseFromOutside={mode === 'create'}
      confirmColor="tertiary-transparent"
      confirmText={t('CreateDataSourceDialog.goBack')}
      onConfirm={() => {
        setMode(null);
      }}
      trigger={
        <Button
          preIcon={<PlusIcon />}
          color="primary"
          label={t('CreateDataSourceDialog.trigger')}
        />
      }
      title="Add new data source"
    >
      <CreateDataSourceDialogInner
        mode={mode}
        onClose={() => {
          setOpen(false);
        }}
        setMode={setMode}
      />
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
    [onClose]
  );

  const queryClient = useQueryClient();
  const { mutate, isPending } = useSourcesServiceUploadFileToSource({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: UseSourcesServiceListFilesFromSourceKeyFn({
          sourceId: sourceId,
          limit: 1000,
        }),
      });

      void queryClient.invalidateQueries({
        queryKey: UseJobsServiceListActiveJobsKeyFn(),
      });

      onClose();
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
        sourceId: sourceId,
      });
    },
    [mutate, sourceId]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen
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
  props: DetachDataSourceConfirmDialogProps
) {
  const { sourceName, sourceId, onClose } = props;
  const { id: agentId } = useCurrentAgent();
  const t = useTranslations('ADE/EditDataSourcesPanel');
  const queryClient = useQueryClient();

  const {
    mutate: detachSource,
    isError,
    isPending,
  } = useSourcesServiceDetachAgentFromSource({
    onSuccess: (_, variables) => {
      onClose();
      queryClient.setQueriesData<
        AgentsServiceGetAgentSourcesDefaultResponse | undefined
      >(
        {
          queryKey: UseAgentsServiceGetAgentSourcesKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return oldData.filter(
            (currentSource) => currentSource.id !== variables.sourceId
          );
        }
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

interface DeleteFilePayload {
  sourceId: string;
  fileId: string;
  onClose: () => void;
  fileName: string;
}

function DeleteFileDialog(props: DeleteFilePayload) {
  const queryClient = useQueryClient();
  const { sourceId, fileId, fileName, onClose } = props;
  const t = useTranslations('ADE/EditDataSourcesPanel');

  const { mutate, isPending, isError } = useSourcesServiceDeleteFileFromSource({
    onSuccess: () => {
      onClose();
      queryClient.setQueriesData<ListFilesFromSourceResponse | undefined>(
        {
          queryKey: UseSourcesServiceListFilesFromSourceKeyFn({
            sourceId,
            limit: 1000,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return oldData.filter((file) => file.id !== fileId);
        }
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

interface EditDataSourcesContentProps {
  search: string;
}

function EditDataSourcesContent(props: EditDataSourcesContentProps) {
  const { id: agentId } = useCurrentAgent();
  const t = useTranslations('ADE/EditDataSourcesPanel');
  const [sourceToDetach, setSourceToDetach] = useState<Source | null>(null);
  const [fileToDelete, setFileToDelete] = useState<Omit<
    DeleteFilePayload,
    'onClose'
  > | null>(null);

  const { search } = props;
  const { data: sources } = useAgentsServiceGetAgentSources({
    agentId,
  });

  const { data } = useJobsServiceListActiveJobs(undefined, undefined, {
    refetchInterval: 3000,
  });

  const sourceIdsBeingProcessedSet = useMemo(() => {
    if (!data) {
      return new Set<string>();
    }

    return new Set(
      data.map((job) => get(job.metadata_, 'source_id')).filter(Boolean)
    );
  }, [data]);

  const fileIdsBeingProcessedSet = useMemo(() => {
    if (!data) {
      return new Set<string>();
    }

    return new Set(
      data.map((job) => get(job.metadata_, 'file_id')).filter(Boolean)
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

        return {
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
          ],
          useContents: () => {
            const { data, isLoading } = useSourcesServiceListFilesFromSource({
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
      {fileToDelete && (
        <DeleteFileDialog
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
      <FileTree root={filteredSources} />
    </>
  );
}

function EditDataSourcesPanel() {
  const [search, setSearch] = useState('');

  return (
    <VStack fullHeight gap={false}>
      <PanelBar
        searchValue={search}
        onSearch={setSearch}
        actions={<CreateDataSourceDialog />}
      ></PanelBar>
      <PanelMainContent>
        <EditDataSourcesContent search={search} />
      </PanelMainContent>
    </VStack>
  );
}

export const editDataSourcesPanel = {
  useGetTitle: () => {
    const t = useTranslations('ADE/EditDataSourcesPanel');

    return t('title');
  },
  data: z.undefined(),
  content: EditDataSourcesPanel,
  templateId: 'edit-data-sources',
} satisfies PanelTemplate<'edit-data-sources'>;
