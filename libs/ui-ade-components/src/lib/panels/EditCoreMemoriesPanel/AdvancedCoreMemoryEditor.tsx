import {
  Alert,
  Button,
  CloseIcon,
  CloseMiniApp,
  Dialog,
  FolderIcon,
  Form,
  FormActions,
  FormField,
  FormProvider,
  HStack,
  Input,
  LoadingEmptyStatusComponent,
  MiniApp,
  PlusIcon,
  RawInput,
  SearchIcon,
  TextArea,
  toast,
  TrashIcon,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useMemo, useState } from 'react';
import { atom, useAtom, useSetAtom } from 'jotai';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../hooks';
import { useFormContext } from 'react-hook-form';
import type { Block, AgentState } from '@letta-cloud/sdk-core';
import {
  useAgentsServiceAttachCoreMemoryBlock,
  useAgentsServiceModifyCoreMemoryBlock,
  UseAgentsServiceRetrieveAgentKeyFn,
  useBlocksServiceCreateBlock,
  useBlocksServiceDeleteBlock,
} from '@letta-cloud/sdk-core';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useSortedMemories } from '@letta-cloud/utils-client';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';

interface CurrentAdvancedCoreMemoryState {
  selectedMemoryBlockLabel?: string;
  isOpen: boolean;
}

interface MemoryWarningProps {
  rootLabel: string;
}
function MemoryWarning(props: MemoryWarningProps) {
  const { getValues } = useFormContext();
  const { rootLabel } = props;
  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');

  const { label } = getValues();

  if (label === rootLabel) {
    return null;
  }

  return (
    <Alert title={t('MemoryWarning.title')} variant="warning">
      {t('MemoryWarning.message')}
    </Alert>
  );
}

interface CharacterCounterProps {
  value: string;
}

function CharacterCounter(props: CharacterCounterProps) {
  const { value } = props;
  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');
  const { getValues } = useFormContext();

  const { maxCharacters } = getValues();

  return (
    <Typography
      variant="body2"
      color={value.length > maxCharacters ? 'destructive' : 'muted'}
    >
      {t('CharacterCounter.count', {
        count: value.length,
      })}
    </Typography>
  );
}

interface AdvancedMemoryEditorProps {
  memory: Block;
  onClose: () => void;
}

function AdvancedMemoryEditorForm(props: AdvancedMemoryEditorProps) {
  const { memory } = props;
  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');

  const agent = useCurrentAgent();

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  const memoryUpdateSchema = useMemo(() => {
    return z.object({
      label: z
        .string()
        .regex(
          /^[a-zA-Z_-][a-zA-Z0-9_-]*$/,
          t('AdvancedMemoryEditorForm.label.error'),
        ),
      maxCharacters: z.coerce
        .number()
        .min(100, t('AdvancedMemoryEditorForm.maxCharacters.error')),
      value: z.string(),
    });
  }, [t]);

  type MemoryUpdatePayload = z.infer<typeof memoryUpdateSchema>;

  const form = useForm<MemoryUpdatePayload>({
    resolver: zodResolver(memoryUpdateSchema),
    defaultValues: {
      label: memory.label || '',
      maxCharacters: memory.limit,
      value: memory.value,
    },
  });

  const queryClient = useQueryClient();

  const { mutateAsync: updateAgentMemoryByLabel } =
    useAgentsServiceModifyCoreMemoryBlock();
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleUpdate = useCallback(
    async (values: MemoryUpdatePayload) => {
      if (!canUpdateAgent) {
        return;
      }

      try {
        setIsPending(true);
        setIsError(false);

        if (isPending) {
          return;
        }

        if (!memory.label) {
          return;
        }

        await updateAgentMemoryByLabel({
          agentId: agent.id,
          blockLabel: memory.label,
          requestBody: {
            limit: values.maxCharacters,
            value: values.value,
          },
        });

        queryClient.setQueriesData<AgentState | undefined>(
          {
            queryKey: UseAgentsServiceRetrieveAgentKeyFn({
              agentId: agent.id,
            }),
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              memory: {
                ...oldData.memory,
                blocks: oldData.memory.blocks.map((block) => {
                  if (block.label === memory.label) {
                    return {
                      ...block,
                      limit: values.maxCharacters,
                      value: values.value,
                    };
                  }

                  return block;
                }),
              },
            };
          },
        );
      } catch (_e) {
        setIsError(true);
      } finally {
        setIsPending(false);
      }
    },
    [
      agent.id,
      canUpdateAgent,
      isPending,
      memory.label,
      queryClient,
      updateAgentMemoryByLabel,
    ],
  );

  const { isTemplate } = useCurrentAgentMetaData();

  return (
    <VStack fullHeight fullWidth padding gap="form">
      <FormProvider {...form}>
        <HStack align="end">
          <HStack fullWidth>
            <FormField
              name="label"
              render={({ field }) => (
                <Input
                  fullWidth
                  disabled
                  warned={field.value !== memory.label}
                  label={t('AdvancedMemoryEditorForm.label.label')}
                  {...field}
                />
              )}
            />
            {!isTemplate && (
              <RawInput
                fullWidth
                disabled
                value={memory.id}
                allowCopy
                label={t('AdvancedMemoryEditorForm.id.label')}
              />
            )}
          </HStack>
          <DeleteMemoryBlockDialog blockId={memory.id || ''} />
        </HStack>
        <Form onSubmit={form.handleSubmit(handleUpdate)}>
          <MemoryWarning rootLabel={memory.label || ''} />

          <FormField
            name="maxCharacters"
            render={({ field }) => (
              <Input
                fullWidth
                type="number"
                disabled={!canUpdateAgent}
                label={t('AdvancedMemoryEditorForm.maxCharacters.label')}
                {...field}
              />
            )}
          />
          <FormField
            name="value"
            render={({ field }) => (
              <TextArea
                rightOfLabelContent={<CharacterCounter value={field.value} />}
                autosize={false}
                fullHeight
                disabled={!canUpdateAgent}
                data-testid="advanced-memory-editor-value"
                fullWidth
                label={t('AdvancedMemoryEditorForm.value.label')}
                {...field}
              />
            )}
          />

          {canUpdateAgent && (
            <FormActions
              errorMessage={
                isError ? t('AdvancedMemoryEditorForm.error') : undefined
              }
            >
              <Button
                label={t('AdvancedMemoryEditorForm.update')}
                busy={isPending}
                data-testid="advanced-memory-editor-update"
              />
            </FormActions>
          )}
        </Form>
      </FormProvider>
    </VStack>
  );
}

interface CreateNewMemoryBlockFormProps {
  trigger: React.ReactNode;
}

function CreateNewMemoryBlockForm(props: CreateNewMemoryBlockFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');

  const setSelectMemoryBlockLabel = useSetAtom(currentAdvancedCoreMemoryAtom);
  const agent = useCurrentAgent();

  const existingMemoryLabels = useMemo(() => {
    return new Set(
      agent.memory?.blocks
        .filter((block) => block.label)
        .map((block) => block.label || ''),
    );
  }, [agent.memory]);

  const {
    mutate: createBlock,
    reset: resetCreating,
    isPending: isCreatingBlock,
  } = useBlocksServiceCreateBlock();
  const {
    mutate: attachBlock,
    reset: resetAttaching,
    isPending: isAttachingBlock,
  } = useAgentsServiceAttachCoreMemoryBlock();

  const CreateNewMemoryBlockSchema = useMemo(() => {
    return z.object({
      label: z
        .string()
        .min(1, t('CreateNewMemoryBlockForm.label.error'))
        .regex(
          /^[a-zA-Z_-][a-zA-Z0-9_-]*$/,
          t('CreateNewMemoryBlockForm.label.error'),
        )
        .refine((value) => {
          return !existingMemoryLabels.has(value);
        }, t('CreateNewMemoryBlockForm.label.exists')),
    });
  }, [existingMemoryLabels, t]);

  type CreateNewMemoryBlockPayload = z.infer<typeof CreateNewMemoryBlockSchema>;

  const form = useForm<CreateNewMemoryBlockPayload>({
    resolver: zodResolver(CreateNewMemoryBlockSchema),
    defaultValues: {
      label: '',
    },
  });

  const queryClient = useQueryClient();

  const handleCreateBlock = useCallback(
    async (values: CreateNewMemoryBlockPayload) => {
      createBlock(
        {
          requestBody: {
            label: values.label,
            value: '',
            limit: 6000,
          },
        },
        {
          onSuccess: (data) => {
            if (!data.id) {
              toast.error(t('CreateNewMemoryBlockForm.createBlockError'));
              return;
            }

            attachBlock(
              {
                agentId: agent.id,
                blockId: data.id,
              },
              {
                onSuccess: (nextAgentState) => {
                  setSelectMemoryBlockLabel((prev) => ({
                    ...prev,
                    selectedMemoryBlockLabel: values.label,
                  }));

                  queryClient.setQueriesData<AgentState | undefined>(
                    {
                      queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                        agentId: agent.id,
                      }),
                    },
                    () => {
                      return nextAgentState;
                    },
                  );

                  resetCreating();
                  resetAttaching();
                  form.reset();
                  setIsOpen(false);
                },
              },
            );
          },
        },
      );
    },
    [
      agent.id,
      attachBlock,
      createBlock,
      form,
      setSelectMemoryBlockLabel,
      queryClient,
      resetAttaching,
      resetCreating,
      t,
    ],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen={isOpen}
        onSubmit={form.handleSubmit(handleCreateBlock)}
        onOpenChange={setIsOpen}
        isConfirmBusy={isCreatingBlock || isAttachingBlock}
        trigger={props.trigger}
        testId="create-new-memory-block-dialog"
        title={t('CreateNewMemoryBlockForm.title')}
      >
        <VStack fullWidth gap="form">
          <FormField
            name="label"
            render={({ field }) => (
              <Input
                data-testid="create-new-memory-block-label-input"
                fullWidth
                label={t('CreateNewMemoryBlockForm.label.label')}
                description={t('CreateNewMemoryBlockForm.label.description')}
                {...field}
              />
            )}
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

interface DeleteMemoryBlockDialogProps {
  blockId: string;
}

function DeleteMemoryBlockDialog(props: DeleteMemoryBlockDialogProps) {
  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');
  const { id: agentId } = useCurrentAgent();
  const { blockId } = props;
  const queryClient = useQueryClient();
  const setSelectMemoryBlockLabel = useSetAtom(currentAdvancedCoreMemoryAtom);

  const {
    isError: deleteError,
    mutate: deleteBlock,
    reset: resetDeleting,
    isPending: isDeletingBlock,
  } = useBlocksServiceDeleteBlock();

  const [isOpen, setIsOpen] = useState(false);

  const handleDeleteBlock = useCallback(() => {
    deleteBlock(
      {
        blockId,
      },
      {
        onSuccess: () => {
          queryClient.setQueriesData<AgentState | undefined>(
            {
              queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                agentId: agentId,
              }),
            },
            (data) => {
              if (!data) {
                return data;
              }

              const nextBlocks = data.memory.blocks.filter(
                (block) => block.id !== blockId,
              );

              if (nextBlocks?.[0].label) {
                setSelectMemoryBlockLabel((prev) => ({
                  ...prev,
                  selectedMemoryBlockLabel: nextBlocks[0].label || '',
                }));
              } else {
                setSelectMemoryBlockLabel((prev) => ({
                  ...prev,
                  selectedMemoryBlockLabel: '',
                }));
              }

              return {
                ...data,
                memory: {
                  ...data.memory,
                  blocks: nextBlocks,
                },
              };
            },
          );

          resetDeleting();
          setIsOpen(false);
        },
      },
    );
  }, [
    agentId,
    setSelectMemoryBlockLabel,
    deleteBlock,
    blockId,
    queryClient,
    resetDeleting,
  ]);

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  if (!canUpdateAgent) {
    return null;
  }

  return (
    <Dialog
      errorMessage={
        deleteError ? t('DeleteMemoryBlockDialog.error') : undefined
      }
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <Button
          hideLabel
          data-testid="delete-memory-block"
          preIcon={<TrashIcon />}
          color="secondary"
          label={t('DeleteMemoryBlockDialog.trigger')}
        />
      }
      testId="delete-memory-block-dialog"
      title={t('DeleteMemoryBlockDialog.title')}
      onConfirm={handleDeleteBlock}
      confirmText={t('DeleteMemoryBlockDialog.confirm')}
      isConfirmBusy={isDeletingBlock}
    >
      <VStack fullWidth gap="form">
        <Typography>{t('DeleteMemoryBlockDialog.description')}</Typography>
      </VStack>
    </Dialog>
  );
}

const currentAdvancedCoreMemoryAtom = atom<CurrentAdvancedCoreMemoryState>({
  selectedMemoryBlockLabel: '',
  isOpen: false,
});

function CoreMemorySidebar() {
  const agent = useCurrentAgent();

  const sortedMemories = useSortedMemories(agent);
  const [search, setSearch] = useState('');
  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');

  const [{ selectedMemoryBlockLabel }, setIsAdvancedCoreMemoryEditorOpen] =
    useAtom(currentAdvancedCoreMemoryAtom);

  const blocks = useMemo(() => {
    if (!sortedMemories) {
      return [];
    }

    return sortedMemories.filter((block) => {
      return (block.label || '').toLowerCase().includes(search.toLowerCase());
    });
  }, [search, sortedMemories]);

  const handleBlockClick = useCallback(
    (label: string) => {
      setIsAdvancedCoreMemoryEditorOpen((prev) => ({
        ...prev,
        selectedMemoryBlockLabel: label,
      }));
    },
    [setIsAdvancedCoreMemoryEditorOpen],
  );

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  return (
    <VStack
      overflow="hidden"
      fullHeight
      minWidth="sidebar"
      gap={false}
      borderRight
      width="sidebar"
    >
      <HStack align="center" padding="small" fullWidth>
        <RawInput
          size="default"
          fullWidth
          hideLabel
          preIcon={<SearchIcon />}
          placeholder={t('CoreMemorySidebar.search.label')}
          label={t('CoreMemorySidebar.search.placeholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
        />
        <CreateNewMemoryBlockForm
          trigger={
            canUpdateAgent && (
              <Button
                hideLabel
                preIcon={<PlusIcon />}
                data-testid="create-new-memory-block-item"
                color="secondary"
                label={t('CoreMemorySidebar.create')}
              />
            )
          }
        />
      </HStack>
      <VStack collapseHeight flex overflowY="auto">
        <VStack>
          {!blocks.length && (
            <HStack fullWidth justify="center" padding align="center">
              <Typography color="muted">
                {t('CoreMemorySidebar.noResults')}
              </Typography>
            </HStack>
          )}
          {blocks.map((block) => {
            const isSelected = block.label === selectedMemoryBlockLabel;
            return (
              <VStack
                aria-selected={isSelected}
                as="button"
                data-testid={`memory-block-${block.label}`}
                key={block.id}
                gap={false}
                onClick={() => {
                  if (!block.label) return;

                  handleBlockClick(block.label);
                }}
                paddingX
                overflowX="hidden"
                align="start"
                wrap={false}
                paddingY="small"
                color={isSelected ? 'background-grey' : 'background'}
              >
                <Typography>{block.label}</Typography>
                <Typography
                  overflow="ellipsis"
                  inline
                  noWrap
                  align="left"
                  color="muted"
                  variant="body3"
                >
                  {block.id}
                </Typography>
              </VStack>
            );
          })}
        </VStack>
      </VStack>
    </VStack>
  );
}

function EditorHeader() {
  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');
  return (
    <HStack
      height="header"
      align="center"
      justify="spaceBetween"
      borderBottom
      paddingX
      fullWidth
    >
      <HStack>
        <FolderIcon />
        <Typography bold>{t('title')}</Typography>
      </HStack>
      <CloseMiniApp data-testid="close-advanced-core-memory-editor">
        <HStack>
          <CloseIcon />
        </HStack>
      </CloseMiniApp>
    </HStack>
  );
}

export function useAdvancedCoreMemoryEditor() {
  const setIsAdvancedCoreMemoryEditorOpen = useSetAtom(
    currentAdvancedCoreMemoryAtom,
  );

  const open = useCallback(
    (selectedMemoryBlockLabel?: string) => {
      setIsAdvancedCoreMemoryEditorOpen({
        isOpen: true,
        selectedMemoryBlockLabel,
      });
    },
    [setIsAdvancedCoreMemoryEditorOpen],
  );

  const close = useCallback(() => {
    setIsAdvancedCoreMemoryEditorOpen({
      isOpen: false,
      selectedMemoryBlockLabel: '',
    });
  }, [setIsAdvancedCoreMemoryEditorOpen]);

  return {
    open,
    close,
  };
}

function EditorContent() {
  const [{ selectedMemoryBlockLabel }] = useAtom(currentAdvancedCoreMemoryAtom);
  const { close } = useAdvancedCoreMemoryEditor();
  const { memory } = useCurrentAgent();

  const selectedMemoryBlock = useMemo(() => {
    return memory?.blocks.find(
      (block) => block.label === selectedMemoryBlockLabel,
    );
  }, [memory, selectedMemoryBlockLabel]);

  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');

  if (!selectedMemoryBlock) {
    return (
      <LoadingEmptyStatusComponent emptyMessage={t('EditorContent.empty')} />
    );
  }

  return (
    <AdvancedMemoryEditorForm
      key={selectedMemoryBlock.id}
      memory={selectedMemoryBlock}
      onClose={close}
    />
  );
}

export function AdvancedCoreMemoryEditor() {
  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');
  const [
    { isOpen: isAdvancedCoreMemoryEditorOpen },
    setIsAdvancedCoreMemoryEditorOpen,
  ] = useAtom(currentAdvancedCoreMemoryAtom);

  return (
    <MiniApp
      isOpen={isAdvancedCoreMemoryEditorOpen}
      onOpenChange={(open) => {
        setIsAdvancedCoreMemoryEditorOpen({
          isOpen: open,
          selectedMemoryBlockLabel: '',
        });
      }}
      appName={t('title')}
    >
      <VStack fullWidth fullHeight gap={false}>
        <EditorHeader />
        <HStack flex collapseHeight overflow="hidden" fullWidth>
          <CoreMemorySidebar />
          <EditorContent />
        </HStack>
      </VStack>
    </MiniApp>
  );
}
