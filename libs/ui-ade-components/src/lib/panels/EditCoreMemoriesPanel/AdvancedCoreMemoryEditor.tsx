import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DynamicApp,
  Form,
  FormActions,
  FormField,
  FormProvider,
  HStack,
  Input,
  isMultiValue,
  LinkIcon,
  LoadingEmptyStatusComponent,
  PlusIcon,
  RawInput,
  RawSelect,
  SearchIcon,
  TextArea,
  TrashIcon,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { atom, useAtom, useSetAtom } from 'jotai';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../hooks';
import { useFormContext } from 'react-hook-form';
import type { Block, AgentState } from '@letta-cloud/sdk-core';
import {
  useAgentsServiceModifyCoreMemoryBlock,
  UseAgentsServiceRetrieveAgentKeyFn,
  useBlocksServiceDeleteBlock,
} from '@letta-cloud/sdk-core';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useSortedMemories } from '@letta-cloud/utils-client';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { CreateNewMemoryBlockDialog } from './CreateNewMemoryBlockDialog/CreateNewMemoryBlockDialog';
import './AdvancedCoreMemoryEditor.scss';
import { currentAdvancedCoreMemoryAtom } from './currentAdvancedCoreMemoryAtom';
import { AttachMemoryBlockDialog } from './AttachMemoryBlockDialog/AttachMemoryBlockDialog';
import { UseBlocksServiceInfiniteQuery } from '../../SearchMemoryBlocks/SearchMemoryBlocks';
import { DetachMemoryBlock } from './DetachMemoryBlock/DetachMemoryBlock';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

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
  onFormDirtyChange?: (isDirty: boolean) => void;
}

function AdvancedMemoryEditorForm(props: AdvancedMemoryEditorProps) {
  const { memory, onFormDirtyChange } = props;
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
      readOnly: z.boolean(),
      description: z.string(),
      preserveOnMigration: z.boolean().optional(),
    });
  }, [t]);

  type MemoryUpdatePayload = z.infer<typeof memoryUpdateSchema>;

  const form = useForm<MemoryUpdatePayload>({
    resolver: zodResolver(memoryUpdateSchema),
    defaultValues: {
      label: memory.label || '',
      maxCharacters: memory.limit,
      value: memory.value,
      description: memory.description || '',
      readOnly: memory.read_only || false,
      preserveOnMigration: memory.preserve_on_migration || false,
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

        trackClientSideEvent(AnalyticsEvent.UPDATE_BLOCK_IN_CORE_MEMORY, {
          agentId: agent.id,
        });

        await updateAgentMemoryByLabel({
          agentId: agent.id,
          blockLabel: memory.label,
          requestBody: {
            description: values.description,
            read_only: values.readOnly,
            preserve_on_migration: values.preserveOnMigration,
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
                      description: values.description,
                      read_only: values.readOnly,
                      value: values.value,
                    };
                  }

                  return block;
                }),
              },
            };
          },
        );

        form.reset(values);
      } catch (_e) {
        setIsError(true);
      } finally {
        setIsPending(false);
      }
    },
    [
      agent.id,
      canUpdateAgent,
      form,
      isPending,
      memory.label,
      queryClient,
      updateAgentMemoryByLabel,
    ],
  );

  const { isTemplate } = useCurrentAgentMetaData();

  useEffect(() => {
    onFormDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onFormDirtyChange]);

  return (
    <VStack fullHeight fullWidth padding="medium" gap="form">
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
          <HStack gap={false}>
            <DetachMemoryBlock blockId={memory.id || ''} />
            <DeleteMemoryBlockDialog blockId={memory.id || ''} />
          </HStack>
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
            name="description"
            render={({ field }) => (
              <TextArea
                autosize={false}
                maxRows={3}
                disabled={!canUpdateAgent}
                infoTooltip={{
                  text: t('AdvancedMemoryEditorForm.description.tooltip'),
                }}
                data-testid="advanced-memory-editor-description"
                fullWidth
                label={t('AdvancedMemoryEditorForm.description.label')}
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

          <FormField
            name="readOnly"
            render={({ field }) => (
              <div className="w-[300px]">
                <Checkbox
                  infoTooltip={{
                    text: t('AdvancedMemoryEditorForm.readOnly.tooltip'),
                  }}
                  label={t('AdvancedMemoryEditorForm.readOnly.label')}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                  }}
                  checked={field.value}
                />
              </div>
            )}
          />

          {isTemplate && (
            <FormField
              name="preserveOnMigration"
              render={({ field }) => (
                <div className="w-[300px]">
                  <Checkbox
                    infoTooltip={{
                      text: t(
                        'AdvancedMemoryEditorForm.preserveOnMigration.tooltip',
                      ),
                    }}
                    label={t(
                      'AdvancedMemoryEditorForm.preserveOnMigration.label',
                    )}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                    }}
                    checked={field.value}
                  />
                </div>
              )}
            />
          )}

          {canUpdateAgent && (
            <VStack paddingBottom>
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
            </VStack>
          )}
        </Form>
      </FormProvider>
    </VStack>
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
    trackClientSideEvent(AnalyticsEvent.DELETE_BLOCK_IN_CORE_MEMORY, {
      agentId,
    });

    deleteBlock(
      {
        blockId,
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: UseBlocksServiceInfiniteQuery({}).slice(0, 2),
            exact: false,
          });

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

              if (nextBlocks?.[0]?.label) {
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
          color="tertiary"
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

function CoreMemoryMobileNav() {
  const agent = useCurrentAgent();

  const sortedMemories = useSortedMemories(agent);
  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');

  const [{ selectedMemoryBlockLabel }, setIsAdvancedCoreMemoryEditorOpen] =
    useAtom(currentAdvancedCoreMemoryAtom);

  const options = useMemo(() => {
    if (!sortedMemories) {
      return [];
    }

    return sortedMemories.map((block) => ({
      label: block.label || '',
      value: block.label || '',
      id: block.id,
    }));
  }, [sortedMemories]);

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

  const selectedOption = useMemo(() => {
    return options.find((option) => option.label === selectedMemoryBlockLabel);
  }, [options, selectedMemoryBlockLabel]);

  if (options.length === 0) {
    return null;
  }

  return (
    <HStack
      className="advanced-memory-container--mobilenav"
      borderBottom
      padding="small"
    >
      <RawSelect
        fullWidth
        hideLabel
        label={t('CoreMemoryMobileNav.label')}
        options={options}
        value={selectedOption}
        onSelect={(value) => {
          if (!value) return;

          if (isMultiValue(value)) {
            return;
          }

          handleBlockClick(value.label || '');
        }}
      />
      <CreateNewMemoryBlockDialog
        trigger={
          canUpdateAgent && (
            <Button
              hideLabel
              preIcon={<PlusIcon />}
              data-testid="create-new-memory-block-item"
              color="tertiary"
              label={t('CoreMemorySidebar.create')}
            />
          )
        }
      />
      {canUpdateAgent && (
        <AttachMemoryBlockDialog
          trigger={
            <Button
              hideLabel
              preIcon={<LinkIcon />}
              data-testid="create-new-memory-block-item"
              color="tertiary"
              label={t('CoreMemorySidebar.attach')}
            />
          }
        />
      )}
    </HStack>
  );
}

const hasUnsavedChangesAtom = atom<boolean>(false);

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

  if (blocks.length === 0) {
    return null;
  }

  return (
    <VStack
      overflow="hidden"
      fullHeight
      minWidth="sidebar"
      className="advanced-memory-container--sidebar"
      gap={false}
      borderRight
      width="sidebar"
    >
      <VStack align="start" padding="small" fullWidth>
        <RawInput
          size="default"
          fullWidth
          variant="tertiary"
          hideLabel
          postIcon={<SearchIcon />}
          placeholder={t('CoreMemorySidebar.search.label')}
          label={t('CoreMemorySidebar.search.placeholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
        />
        <HStack align="center">
          <CreateNewMemoryBlockDialog
            trigger={
              canUpdateAgent && (
                <Button
                  preIcon={<PlusIcon />}
                  data-testid="create-new-memory-block-item"
                  color="secondary"
                  size="small"
                  label={t('CoreMemorySidebar.create')}
                />
              )
            }
          />
          {canUpdateAgent && (
            <AttachMemoryBlockDialog
              trigger={
                <Button
                  preIcon={<LinkIcon />}
                  data-testid="create-new-memory-block-item"
                  color="tertiary"
                  size="small"
                  label={t('CoreMemorySidebar.attach')}
                />
              }
            />
          )}
        </HStack>
      </VStack>
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
                color={isSelected ? 'background-grey3' : 'transparent'}
              >
                <Typography>{block.label}</Typography>
                <Typography
                  overflow="ellipsis"
                  noWrap
                  align="left"
                  color="muted"
                  variant="body3"
                  fullWidth
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

export function useAdvancedCoreMemoryEditor() {
  const setIsAdvancedCoreMemoryEditorOpen = useSetAtom(
    currentAdvancedCoreMemoryAtom,
  );

  const [{ isOpen }] = useAtom(currentAdvancedCoreMemoryAtom);

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
    isOpen,
  };
}

function EditorContent() {
  const [{ selectedMemoryBlockLabel }] = useAtom(currentAdvancedCoreMemoryAtom);
  const { close } = useAdvancedCoreMemoryEditor();
  const { memory } = useCurrentAgent();
  const setHasUnsavedChanges = useSetAtom(hasUnsavedChangesAtom);

  const selectedMemoryBlock = useMemo(() => {
    return memory?.blocks.find(
      (block) => block.label === selectedMemoryBlockLabel,
    );
  }, [memory, selectedMemoryBlockLabel]);

  useEffect(() => {
    setHasUnsavedChanges(false);
  }, [selectedMemoryBlockLabel, setHasUnsavedChanges]);

  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');
  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  if (!selectedMemoryBlock) {
    return (
      <LoadingEmptyStatusComponent
        loaderFillColor="background-grey"
        emptyMessage={t('EditorContent.empty')}
        emptyAction={
          <CreateNewMemoryBlockDialog
            trigger={
              canUpdateAgent && (
                <VStack>
                  <CreateNewMemoryBlockDialog
                    trigger={
                      <Button
                        preIcon={<PlusIcon />}
                        data-testid="create-new-memory-block-item"
                        color="secondary"
                        size="small"
                        label={t('CoreMemorySidebar.create')}
                      />
                    }
                  />
                  <AttachMemoryBlockDialog
                    trigger={
                      <Button
                        size="small"
                        hideLabel
                        preIcon={<LinkIcon />}
                        color="tertiary"
                        label={t('CoreMemorySidebar.attach')}
                      />
                    }
                  />
                </VStack>
              )
            }
          />
        }
      />
    );
  }

  return (
    <VStack fullWidth fullHeight overflowY="auto">
      <AdvancedMemoryEditorForm
        key={selectedMemoryBlock.id}
        memory={selectedMemoryBlock}
        onClose={close}
        onFormDirtyChange={setHasUnsavedChanges}
      />
    </VStack>
  );
}

export function AdvancedCoreMemoryEditor() {
  const t = useTranslations('ADE/AdvancedCoreMemoryEditor');
  const [
    { isOpen: isAdvancedCoreMemoryEditorOpen },
    setIsAdvancedCoreMemoryEditorOpen,
  ] = useAtom(currentAdvancedCoreMemoryAtom);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useAtom(
    hasUnsavedChangesAtom,
  );

  const [isConfirmLeaveOpen, setIsConfirmLeaveOpen] = useState(false);

  return (
    <>
      <Dialog
        title={t('ConfirmLeave.title')}
        isOpen={isConfirmLeaveOpen}
        onOpenChange={setIsConfirmLeaveOpen}
        onConfirm={() => {
          setIsConfirmLeaveOpen(false);
          setHasUnsavedChanges(false);
          setIsAdvancedCoreMemoryEditorOpen((prev) => ({
            ...prev,
            isOpen: false,
          }));
        }}
      >
        {t('ConfirmLeave.description')}
      </Dialog>
      <DynamicApp
        defaultView="fullscreen"
        isOpen={isAdvancedCoreMemoryEditorOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (hasUnsavedChanges) {
              setIsConfirmLeaveOpen(true);
              return;
            }
            setIsAdvancedCoreMemoryEditorOpen((prev) => ({
              ...prev,
              isOpen: false,
            }));
            return;
          }

          setIsAdvancedCoreMemoryEditorOpen({
            isOpen: open,
            selectedMemoryBlockLabel: '',
          });
          setHasUnsavedChanges(false);
        }}
        windowConfiguration={{
          minWidth: 480,
          minHeight: 400,
          defaultWidth: 600,
          defaultHeight: 600,
        }}
        name={t('title')}
      >
        <VStack
          color="background-grey"
          className="advanced-memory-container"
          fullWidth
          fullHeight
          gap={false}
        >
          <HStack
            flex
            gap={false}
            className="advanced-memory-container--content"
            collapseHeight
            overflow="hidden"
            fullWidth
          >
            <CoreMemoryMobileNav />
            <CoreMemorySidebar />
            <EditorContent />
          </HStack>
        </VStack>
      </DynamicApp>
    </>
  );
}
