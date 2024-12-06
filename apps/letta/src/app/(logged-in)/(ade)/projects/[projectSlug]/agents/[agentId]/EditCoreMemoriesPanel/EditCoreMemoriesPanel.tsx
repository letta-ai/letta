import { z } from 'zod';
import type { PanelTemplate } from '@letta-web/component-library';
import { InfoTooltip } from '@letta-web/component-library';
import {
  Alert,
  Button,
  Form,
  FormActions,
  FormField,
  LettaLoaderPanel,
  RawToggleGroup,
  FormProvider,
  Input,
  TextArea,
  useForm,
} from '@letta-web/component-library';
import { CodeIcon } from '@letta-web/component-library';
import { DialogContentWithCategories } from '@letta-web/component-library';

import { Dialog } from '@letta-web/component-library';
import { HStack, RawTextArea, Typography } from '@letta-web/component-library';
import { VStack } from '@letta-web/component-library';
import { PanelMainContent } from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { useCurrentAgent } from '../hooks';
import { useCallback, useState } from 'react';
import React, { useMemo } from 'react';
import { useDateFormatter } from '@letta-web/helpful-client-utils';
import { useUpdateMemory } from '../hooks/useUpdateMemory/useUpdateMemory';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentSimulatedAgent } from '../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import type { Block, AgentState } from '@letta-web/letta-agents-api';
import { useAgentsServiceUpdateAgentMemoryBlockByLabel } from '@letta-web/letta-agents-api';
import { UseAgentsServiceGetAgentKeyFn } from '@letta-web/letta-agents-api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFormContext } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';

interface MemoryWarningProps {
  rootLabel: string;
}
function MemoryWarning(props: MemoryWarningProps) {
  const { getValues } = useFormContext();
  const { rootLabel } = props;
  const t = useTranslations('ADE/EditCoreMemoriesPanel');

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
  const t = useTranslations('ADE/EditCoreMemoriesPanel');
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
  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const agent = useCurrentAgent();

  const memoryUpdateSchema = useMemo(() => {
    return z.object({
      label: z
        .string()
        .regex(
          /^[a-zA-Z_][a-zA-Z0-9_]*$/,
          t('AdvancedMemoryEditorForm.label.error')
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
    useAgentsServiceUpdateAgentMemoryBlockByLabel();
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleUpdate = useCallback(
    async (values: MemoryUpdatePayload) => {
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
            queryKey: UseAgentsServiceGetAgentKeyFn({
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
          }
        );
      } catch (_e) {
        console.log(_e);
        setIsError(true);
      } finally {
        setIsPending(false);
      }
    },
    [agent.id, isPending, memory.label, queryClient, updateAgentMemoryByLabel]
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleUpdate)}>
        <VStack fullHeight fullWidth padding gap="form">
          <MemoryWarning rootLabel={memory.label || ''} />
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

          <FormField
            name="maxCharacters"
            render={({ field }) => (
              <Input
                fullWidth
                type="number"
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
                fullWidth
                label={t('AdvancedMemoryEditorForm.value.label')}
                {...field}
              />
            )}
          />

          <FormActions
            errorMessage={
              isError ? t('AdvancedMemoryEditorForm.error') : undefined
            }
          >
            <Button
              label={t('AdvancedMemoryEditorForm.update')}
              busy={isPending}
            />
          </FormActions>
        </VStack>
      </Form>
    </FormProvider>
  );
}

interface AdvancedEditMemoryProps {
  defaultLabel: string;
  onClose: () => void;
}

function AdvancedEditMemory(props: AdvancedEditMemoryProps) {
  const { defaultLabel, onClose } = props;
  const agent = useCurrentAgent();
  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const memories = useMemo(() => {
    return agent.memory?.blocks || [];
  }, [agent.memory?.blocks]);

  return (
    <Dialog
      isOpen
      noContentPadding
      disableForm
      preventCloseFromOutside
      size="full"
      hideFooter
      title={t('AdvancedEditMemory.title')}
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
    >
      <DialogContentWithCategories
        defaultCategory={defaultLabel}
        categories={memories.map((block) => ({
          id: block.label || '',
          title: block.label || '',
          children: (
            <AdvancedMemoryEditorForm
              key={block.label}
              memory={block}
              onClose={onClose}
            />
          ),
        }))}
      />
    </Dialog>
  );
}

interface AdvancedEditorPayload {
  label: string;
  memory: Block;
}

interface EditMemoryFormProps extends AdvancedEditorPayload {
  isModelView?: boolean;
}

function EditMemoryForm(props: EditMemoryFormProps) {
  const { label, memory, isModelView } = props;

  const { formatDateAndTime } = useDateFormatter();

  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  const [isAdvancedEditOpen, setIsAdvancedEditOpen] = useState(false);

  const { value, onChange, error, lastUpdatedAt, isUpdating } = useUpdateMemory(
    {
      label,
    }
  );

  return (
    <>
      {isAdvancedEditOpen && (
        <AdvancedEditMemory
          onClose={() => {
            setIsAdvancedEditOpen(false);
          }}
          defaultLabel={label}
        />
      )}
      <VStack flex fullHeight>
        <VStack fullWidth fullHeight>
          <RawTextArea
            rightOfLabelContent={
              <Typography variant="body2" color="muted">
                {t('EditMemoryForm.characterLimit', {
                  count: value.length,
                  limit: memory.limit,
                })}
              </Typography>
            }
            autosize={false}
            flex
            fullHeight
            data-testid={`edit-memory-block-${label}-content`}
            fullWidth
            label={label}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            expandable={
              !isModelView
                ? {
                    expandText: t('expandContent'),
                    onExpand: () => {
                      setIsAdvancedEditOpen(true);
                    },
                  }
                : undefined
            }
            value={value}
          />
        </VStack>
        <HStack align="center" justify="spaceBetween">
          <HStack
            paddingBottom={isModelView ? 'small' : undefined}
            justify="start"
          >
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
                    date: formatDateAndTime(lastUpdatedAt),
                  })}
              </Typography>
            )}
          </HStack>
        </HStack>
      </VStack>
    </>
  );
}

function DefaultMemory() {
  const agent = useCurrentAgent();

  const memories = useMemo(() => {
    return agent.memory?.blocks || [];
  }, [agent.memory?.blocks]);

  return memories.map((block, index) => (
    <VStack
      paddingTop="small"
      fullHeight
      borderBottom={index !== memories.length - 1}
      key={block.label || ''}
    >
      <EditMemoryForm memory={block} label={block.label || ''} />
    </VStack>
  ));
}

function SimulatedMemory() {
  const { agentSession } = useCurrentSimulatedAgent();
  const agent = useMemo(() => {
    return agentSession?.body.agent;
  }, [agentSession]);

  const memories = useMemo(() => {
    if (!agent) {
      return [];
    }

    return agent.memory?.blocks || [];
  }, [agent]);

  if (!agent) {
    return <LettaLoaderPanel />;
  }

  return memories.map((block, index) => (
    <VStack
      paddingTop="small"
      fullHeight
      borderBottom={index !== memories.length - 1}
      key={block.label || ''}
    >
      <VStack fullHeight flex paddingBottom="small">
        <RawTextArea
          autosize={false}
          flex
          fullHeight
          resize="none"
          fullWidth
          data-testid={`simulated-memory:${block.label}`}
          disabled
          label={block.label || ''}
          value={block.value}
        />
      </VStack>
    </VStack>
  ));
}

type MemoryType = 'simulated' | 'templated';

function EditMemory() {
  const { isTemplate } = useCurrentAgentMetaData();
  const [memoryType, setMemoryType] = useState<MemoryType>('templated');

  const t = useTranslations('ADE/EditCoreMemoriesPanel');

  return (
    <PanelMainContent variant="noPadding">
      <VStack fullHeight gap={false}>
        <VStack paddingX="small">
          {isTemplate && (
            <RawToggleGroup
              border
              fullWidth
              value={memoryType}
              hideLabel
              onValueChange={(value) => {
                if (!value) {
                  return;
                }

                setMemoryType(value as MemoryType);
              }}
              label={t('toggleMemoryType.label')}
              items={[
                {
                  label: t('toggleMemoryType.templated.label'),
                  value: 'templated',
                  postIcon: (
                    <InfoTooltip
                      text={t('toggleMemoryType.templated.tooltip')}
                    />
                  ),
                },
                {
                  label: t('toggleMemoryType.simulated.label'),
                  value: 'simulated',
                  postIcon: (
                    <InfoTooltip
                      text={t('toggleMemoryType.simulated.tooltip')}
                    />
                  ),
                },
              ]}
            />
          )}
        </VStack>
        <VStack fullHeight gap="small" paddingX="large" paddingBottom="small">
          {memoryType === 'templated' ? <DefaultMemory /> : <SimulatedMemory />}
        </VStack>
      </VStack>
    </PanelMainContent>
  );
}

export const editCoreMemories = {
  templateId: 'edit-core-memories',
  content: EditMemory,
  icon: <CodeIcon />,
  useGetMobileTitle: () => {
    const t = useTranslations('ADE/EditCoreMemoriesPanel');

    return t('mobileTitle');
  },
  useGetInfoTooltipText: () => {
    const t = useTranslations('ADE/EditCoreMemoriesPanel');

    return t('infoTooltip');
  },
  useGetTitle: () => {
    const t = useTranslations('ADE/EditCoreMemoriesPanel');
    const { memory } = useCurrentAgent();

    const memoryCount = (memory?.blocks || []).length;

    return t('title', { count: memoryCount || '-' });
  },
  data: z.undefined(),
} satisfies PanelTemplate<'edit-core-memories'>;
