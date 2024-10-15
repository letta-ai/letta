import { z } from 'zod';
import type {
  DialogTableItem,
  PanelTemplate,
} from '@letta-web/component-library';
import {
  ActionCard,
  Alert,
  FileIcon,
  FilePlusIcon,
  FileTree,
  FormField,
  FormProvider,
  LettaLoader,
  LoadingEmptyStatusComponent,
  PanelMainContent,
  PlusIcon,
  SingleFileUpload,
  Spinner,
  TrashIcon,
  Typography,
  useForm,
} from '@letta-web/component-library';
import { Dialog, DialogTable, RawInput } from '@letta-web/component-library';
import { Button, HStack, PanelBar } from '@letta-web/component-library';
import { VStack } from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AgentsServiceGetAgentSourcesDefaultResponse,
  useAgentsServiceGetAgentSources,
  UseAgentsServiceGetAgentSourcesKeyFn,
  UseJobsServiceListActiveJobsKeyFn,
  useSourcesServiceAttachAgentToSource,
  useSourcesServiceCreateSource,
  useSourcesServiceDetachAgentFromSource,
  useSourcesServiceListFilesFromSource,
  UseSourcesServiceListFilesFromSourceKeyFn,
  useSourcesServiceListSources,
  useSourcesServiceUploadFileToSource,
} from '@letta-web/letta-agents-api';
import { useCurrentAgent } from '../hooks';
import { useQueryClient } from '@tanstack/react-query';
import {
  DatabaseBackupIcon,
  DatabaseIcon,
  DatabaseZapIcon,
  FileOutputIcon,
  SearchIcon,
} from 'lucide-react';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { zodResolver } from '@hookform/resolvers/zod';

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
            icon={<DatabaseZapIcon />}
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
          size="small"
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

interface EditDataSourcesContentProps {
  search: string;
}

function EditDataSourcesContent(props: EditDataSourcesContentProps) {
  const { id: agentId } = useCurrentAgent();
  const t = useTranslations('ADE/EditDataSourcesPanel');

  const { search } = props;
  const { data: sources } = useAgentsServiceGetAgentSources({
    agentId,
  });

  const queryClient = useQueryClient();

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
        return {
          name: source.name,
          icon: <DatabaseIcon />,
          openIcon: <DatabaseIcon />,
          useContents: () => {
            const { data, isLoading } = useSourcesServiceListFilesFromSource({
              limit: 1000,
              sourceId: source.id || '',
            });

            const { mutate: detachSource, isPending } =
              useSourcesServiceDetachAgentFromSource({
                onSuccess: () => {
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
                        (currentSource) => currentSource.id !== source.id
                      );
                    }
                  );
                },
              });

            const files = useMemo(() => {
              return [
                {
                  name: t('EditDataSourcesContent.detachSource'),
                  onClick: () => {
                    detachSource({
                      agentId,
                      sourceId: source.id || '',
                    });
                  },
                  icon: isPending ? (
                    <Spinner size="small" />
                  ) : (
                    <DatabaseBackupIcon />
                  ),
                },
                {
                  name: t('EditDataSourcesContent.uploadFile'),
                  onClick: () => {
                    setSourceIdToUploadFileTo(source.id || '');
                  },
                  icon: <FilePlusIcon />,
                },
                ...(data || []).map((file) => {
                  return {
                    name: file.file_name,
                    icon: <FileIcon />,
                    openIcon: <FileOutputIcon />,
                    useContents: () => {
                      return {
                        data: [
                          {
                            icon: <TrashIcon />,
                            name: t('EditDataSourcesContent.delete'),
                            onClick: () => {
                              alert('Not implemented');
                            },
                          },
                        ],
                      };
                    },
                  };
                }),
              ];
            }, [data, detachSource, isPending]);

            return {
              isLoading,
              data: files,
            };
          },
        };
      });
  }, [sources, search, queryClient, agentId, t]);

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
