import { z } from 'zod';
import type { PanelTemplate } from '@letta-web/component-library';
import {
  CogIcon,
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-web/component-library';
import {
  DropdownMenu,
  DropdownMenuItem,
  SwapIcon,
} from '@letta-web/component-library';
import {
  Button,
  Dialog,
  ExpandContentIcon,
} from '@letta-web/component-library';
import {
  Accordion,
  Badge,
  HStack,
  RawTextArea,
  Typography,
} from '@letta-web/component-library';
import { VStack } from '@letta-web/component-library';
import { PanelMainContent } from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../hooks';
import { useEffect, useState } from 'react';
import React, { useCallback, useMemo } from 'react';
import { nicelyFormattedDateAndTime } from '@letta-web/helpful-client-utils';
import { zodResolver } from '@hookform/resolvers/zod';

function useUpdateMemory(payload: AdvancedEditorPayload) {
  const { type, label } = payload;
  const { memory, system } = useCurrentAgent();
  const { syncUpdateCurrentAgent, error, lastUpdatedAt, isUpdating } =
    useSyncUpdateCurrentAgent();

  const value = useMemo(() => {
    if (type === 'system') {
      return system;
    }

    return memory?.memory?.[label || '']?.value;
  }, [type, memory?.memory, label, system]);

  const [localValue, setLocalValue] = useState(value || '');

  const handleChange = useCallback(
    (nextValue: string) => {
      setLocalValue(nextValue);

      if (type === 'system') {
        syncUpdateCurrentAgent(() => ({
          system: nextValue,
        }));

        return;
      }

      syncUpdateCurrentAgent((prev) => ({
        memory: {
          ...prev.memory,
          memory: {
            ...prev.memory?.memory,
            [label || '']: {
              ...prev.memory?.memory?.[label || ''],
              value: nextValue,
            },
          },
        },
      }));
    },
    [label, syncUpdateCurrentAgent, type]
  );

  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value || '');
    }
  }, [localValue, value]);

  return {
    value: localValue,
    onChange: handleChange,
    error,
    lastUpdatedAt,
    isUpdating,
  };
}

interface AdvancedCoreMemoryEditorProps extends AdvancedEditorPayload {
  onClose: () => void;
  onChangeMemory: (payload: AdvancedEditorPayload) => void;
}

function AdvancedCoreMemoryEditor(props: AdvancedCoreMemoryEditorProps) {
  const { name, type, onChangeMemory, label, onClose } = props;
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const { value, onChange, error, lastUpdatedAt, isUpdating } =
    useUpdateMemory(props);

  const agent = useCurrentAgent();

  const memories = useMemo(() => {
    return Object.values(agent.memory?.memory || {});
  }, [agent.memory?.memory]);

  return (
    <Dialog
      color="background"
      title={t('AdvancedCoreMemoryEditor.title', {
        name,
      })}
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
      size="full"
      hideConfirm
      isOpen
    >
      <VStack fullHeight gap={false}>
        <HStack
          padding="small"
          height="header-sm"
          align="center"
          justify="spaceBetween"
          fullWidth
          borderTop
          borderLeft
          borderRight
        >
          <HStack align="center">
            <DropdownMenu
              align="start"
              trigger={
                <Button
                  size="small"
                  color="tertiary"
                  preIcon={<SwapIcon />}
                  label={t('AdvancedCoreMemoryEditor.switchView')}
                />
              }
            >
              <DropdownMenuItem
                label={t('systemPrompt')}
                onClick={() => {
                  onChangeMemory({
                    label: 'system',
                    name: t('systemPrompt'),
                    type: 'system',
                  });
                }}
              />
              {memories.map((block) => (
                <DropdownMenuItem
                  key={block.label || ''}
                  label={block.name || ''}
                  onClick={() => {
                    onChangeMemory({
                      label: block.label || '',
                      name: block.name || '',
                      type: 'memory',
                    });
                  }}
                />
              ))}
            </DropdownMenu>
            {type !== 'system' && (
              <Badge color="primary-light" content={label} />
            )}
            <Typography bold variant="body">
              {name}
            </Typography>
          </HStack>
          <HStack justify="start">
            {error ? (
              <Typography variant="body2" color="destructive">
                {t('error')}
              </Typography>
            ) : (
              <Typography variant="body2" color="muted">
                {isUpdating && t('updating')}
                {!isUpdating &&
                  lastUpdatedAt &&
                  t('lastUpdated', {
                    date: nicelyFormattedDateAndTime(lastUpdatedAt),
                  })}
              </Typography>
            )}
          </HStack>
        </HStack>
        <RawTextArea
          hideLabel
          hideFocus
          label={t('AdvancedCoreMemoryEditor.label')}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          fullWidth
          autosize={false}
          fullHeight
        />
      </VStack>
    </Dialog>
  );
}

interface MemorySettingsDialogProps {
  label: string;
  name: string;
}

const memorySettingsFormSchema = z.object({
  name: z.string(),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MemorySettingsDialog(props: MemorySettingsDialogProps) {
  const { label, name } = props;

  const form = useForm<z.infer<typeof memorySettingsFormSchema>>({
    resolver: zodResolver(memorySettingsFormSchema),
    defaultValues: {
      name,
    },
  });

  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const { syncUpdateCurrentAgent, isDebouncing, isUpdating } =
    useSyncUpdateCurrentAgent();

  const handleSubmit = useCallback(
    (values: z.infer<typeof memorySettingsFormSchema>) => {
      syncUpdateCurrentAgent((prev) => ({
        memory: {
          ...prev.memory,
          memory: {
            ...prev.memory?.memory,
            [label || '']: {
              ...prev.memory?.memory?.[label || ''],
              value: prev.memory?.memory?.[label || '']?.value || '',
              name: values.name,
            },
          },
        },
      }));
    },
    [label, syncUpdateCurrentAgent]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        title={t('MemorySettingsDialog.title', {
          label,
        })}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isUpdating || isDebouncing}
        trigger={
          <Button
            preIcon={<CogIcon />}
            label={t('MemorySettingsDialog.trigger')}
            color="tertiary"
            type="button"
            size="small"
          />
        }
      >
        <FormField
          render={({ field }) => (
            <Input
              fullWidth
              {...field}
              label={t('MemorySettingsDialog.name.label')}
              placeholder={t('MemorySettingsDialog.name.placeholder')}
              type="text"
            />
          )}
          name="name"
        />
      </Dialog>
    </FormProvider>
  );
}

interface AdvancedEditorPayload {
  label: string;
  name: string;
  type: 'memory' | 'system';
}

interface EditMemoryFormProps extends AdvancedEditorPayload {
  onAdvancedEdit: () => void;
}

function EditMemoryForm(props: EditMemoryFormProps) {
  const { type, label, name, onAdvancedEdit } = props;

  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const { value, onChange, error, lastUpdatedAt, isUpdating } =
    useUpdateMemory(props);

  return (
    <Accordion
      id="system-prompt"
      trigger={
        <HStack data-testid={`edit-memory-block:${label}`} align="center">
          <Typography bold>{name}</Typography>
          {type === 'memory' && <Badge color="primary-light" content={label} />}
        </HStack>
      }
    >
      <VStack paddingX="small" paddingTop="small">
        <VStack>
          <RawTextArea
            hideLabel
            data-testid="edit-memory-block-content"
            fullWidth
            maxRows={5}
            label={t('content')}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            value={value}
          />
        </VStack>
        <HStack align="center" justify="spaceBetween">
          <HStack justify="start">
            {error ? (
              <Typography variant="body2" color="destructive">
                {t('error')}
              </Typography>
            ) : (
              <Typography variant="body2" color="muted">
                {isUpdating && t('updating')}
                {!isUpdating &&
                  lastUpdatedAt &&
                  t('lastUpdated', {
                    date: nicelyFormattedDateAndTime(lastUpdatedAt),
                  })}
              </Typography>
            )}
          </HStack>
        </HStack>
        <HStack justify="spaceBetween">
          {/*<MemorySettingsDialog name={name} label={label} />*/}
          <Button
            preIcon={<ExpandContentIcon />}
            label={t('expandContent')}
            color="tertiary"
            onClick={onAdvancedEdit}
            type="button"
            size="small"
          />
        </HStack>
      </VStack>
    </Accordion>
  );
}

function EditMemory() {
  const agent = useCurrentAgent();
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
  const [labelToEdit, setLabelToEdit] = useState<AdvancedEditorPayload | null>(
    null
  );

  const memories = useMemo(() => {
    return Object.values(agent.memory?.memory || {});
  }, [agent.memory?.memory]);

  return (
    <PanelMainContent variant="noPadding">
      <EditMemoryForm
        onAdvancedEdit={() => {
          setLabelToEdit({
            label: 'system',
            name: t('systemPrompt'),
            type: 'system',
          });
        }}
        label="system"
        name={t('systemPrompt')}
        type="system"
      />
      {memories.map((block) => (
        <EditMemoryForm
          onAdvancedEdit={() => {
            setLabelToEdit({
              label: block.label || '',
              name: block.name || '',
              type: 'memory',
            });
          }}
          label={block.label || ''}
          name={block.name || ''}
          type="memory"
          key={block.label || ''}
        />
      ))}
      {labelToEdit && (
        <AdvancedCoreMemoryEditor
          {...labelToEdit}
          onChangeMemory={setLabelToEdit}
          onClose={() => {
            setLabelToEdit(null);
          }}
        />
      )}
    </PanelMainContent>
  );
}

export const editCoreMemories = {
  templateId: 'edit-core-memories',
  content: EditMemory,
  useGetTitle: () => {
    const t = useTranslations('ADE/EditCoreMemoriesPanel');
    const { memory } = useCurrentAgent();

    const memoryCount = Object.keys(memory?.memory || {}).length;

    return t('title', { count: memoryCount || '-' });
  },
  data: z.undefined(),
} satisfies PanelTemplate<'edit-core-memories'>;
