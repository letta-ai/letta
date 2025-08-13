import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useId, useMemo, useState } from 'react';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  Switch,
  useForm,
  VStack,
  BillingLink,
  toast,
  TabGroup,
  Accordion,
  Typography,
  TextArea,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAgentsServiceAttachCoreMemoryBlock,
  useBlocksServiceCreateBlock,
  isAPIError,
  type Block,
  type AgentState,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useCurrentAgentMetaData } from '../../../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentAgent } from '../../../hooks';
import type { ExampleBlockPayload } from './ExampleBlocks';
import { ExampleBlocks } from './ExampleBlocks';
import { useSetAtom } from 'jotai/index';
import { currentAdvancedCoreMemoryAtom } from '../currentAdvancedCoreMemoryAtom';
import { UseBlocksServiceInfiniteQuery } from '../../../SearchMemoryBlocks/SearchMemoryBlocks';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { CoreMemoryBlock } from '../types';
import type { CoreMemoryBlockType } from '../types';
import { useADEAppContext } from '../../../AppContext/AppContext';

interface CreateNewMemoryBlockDialogProps {
  trigger: React.ReactNode;
}

function CustomMemoryBlockForm() {
  const t = useTranslations('CreateNewMemoryBlockDialog');
  const id = useId();

  return (
    <VStack paddingTop="small" gap="form">
      <FormField
        name="label"
        render={({ field }) => (
          <Input
            data-testid="memory-block-label-input"
            fullWidth
            variant="secondary"
            {...field}
            label={t('label.label')}
            placeholder={t('label.placeholder')}
            required
          />
        )}
      />

      <FormField
        name="description"
        render={({ field }) => (
          <TextArea
            autosize
            maxRows={3}
            minRows={3}
            data-testid="memory-block-description-input"
            fullWidth
            variant="secondary"
            {...field}
            label={t('description.label')}
            placeholder={t('description.placeholder')}
          />
        )}
      />

      <Accordion
        id={id}
        trigger={
          <Typography variant="body2" uppercase color="muted">
            {t('advanced')}
          </Typography>
        }
      >
        <VStack gap="form" paddingTop paddingX="xxsmall">
          <FormField
            name="value"
            render={({ field }) => (
              <TextArea
                autosize
                maxRows={3}
                minRows={3}
                data-testid="memory-block-value-input"
                fullWidth
                variant="secondary"
                {...field}
                label={t('value.label')}
                placeholder={t('value.placeholder')}
              />
            )}
          />

          <FormField
            name="characterLimit"
            render={({ field }) => (
              <Input
                data-testid="memory-block-character-limit-input"
                fullWidth
                variant="secondary"
                {...field}
                label={t('characterLimit.label')}
                placeholder={t('characterLimit.placeholder')}
                description={t('characterLimit.description')}
                required
              />
            )}
          />

          <FormField
            name="readonly"
            render={({ field }) => (
              <Switch
                fullWidth
                data-testid="memory-block-readonly-switch"
                {...field}
                label={t('readonly.label')}
                description={t('readonly.description')}
              />
            )}
          />
        </VStack>
      </Accordion>
    </VStack>
  );
}

export function CreateNewMemoryBlockDialog(
  props: CreateNewMemoryBlockDialogProps,
) {
  const { trigger } = props;
  const { projectId } = useADEAppContext();
  const [open, setOpen] = React.useState(false);
  const t = useTranslations('CreateNewMemoryBlockDialog');

  const queryClient = useQueryClient();
  const { agentId: currentAgentId } = useCurrentAgentMetaData();
  const agent = useCurrentAgent();

  type TabTypes = 'custom' | 'examples';

  const [tab, setTab] = useState<TabTypes>('custom');
  const [blockType, setBlockType] = useState<CoreMemoryBlockType>(
    CoreMemoryBlock.CUSTOM,
  );

  const setIsAdvancedCoreMemoryEditorOpen = useSetAtom(
    currentAdvancedCoreMemoryAtom,
  );

  const setCurrentMemoryBlock = useCallback(
    (label: string) => {
      setIsAdvancedCoreMemoryEditorOpen((prev) => ({
        ...prev,
        selectedMemoryBlockLabel: label,
      }));
    },
    [setIsAdvancedCoreMemoryEditorOpen],
  );

  const existingMemoryLabels = useMemo(() => {
    return new Set(
      agent?.memory?.blocks
        .filter((block) => block.label)
        .map((block) => block.label || '') || [],
    );
  }, [agent?.memory]);

  const memoryBlockFormSchema = z.object({
    label: z
      .string()
      .min(1, {
        message: t('errors.labelRequired'),
      })
      .regex(/^[a-zA-Z_-][a-zA-Z0-9_-]*$/, t('errors.labelFormat'))
      .refine((value) => {
        return !existingMemoryLabels.has(value);
      }, t('errors.labelExists')),
    description: z.string(),
    value: z.string(),
    characterLimit: z.string().regex(/^\d+$/, {
      message: t('errors.characterLimitMustBeNumber'),
    }),
    readonly: z.boolean(),
  });

  type MemoryBlockFormValues = z.infer<typeof memoryBlockFormSchema>;

  const form = useForm<MemoryBlockFormValues>({
    resolver: zodResolver(memoryBlockFormSchema),
    defaultValues: {
      label: '',
      description: '',
      value: '',
      characterLimit: '5000',
      readonly: false,
    },
  });

  const {
    mutate: createBlock,
    reset: resetCreating,
    isPending: isCreatingBlock,
    error: createError,
  } = useBlocksServiceCreateBlock();

  const {
    mutate: attachBlock,
    reset: resetAttaching,
    isPending: isAttachingBlock,
  } = useAgentsServiceAttachCoreMemoryBlock();

  const isPending = isCreatingBlock || isAttachingBlock;

  const errorMessage = useMemo(() => {
    if (createError) {
      if (isAPIError(createError) && createError.status === 402) {
        return t.rich('errors.overage', {
          link: (chunks) => <BillingLink>{chunks}</BillingLink>,
        });
      }
      return t('errors.default');
    }
    return undefined;
  }, [createError, t]);

  const handleOpenChange = useCallback(
    (nextState: boolean) => {
      setOpen(nextState);
      if (!nextState) {
        form.reset();
        resetCreating();
        resetAttaching();
      }
    },
    [form, resetCreating, resetAttaching],
  );

  const handleSubmit = useCallback(
    async (values: MemoryBlockFormValues) => {
      if (!currentAgentId) {
        toast.error(t('errors.noAgent'));
        return;
      }

      trackClientSideEvent(AnalyticsEvent.CREATE_BLOCK_IN_CORE_MEMORY, {
        agentId: agent.id,
        blockType,
      });

      createBlock(
        {
          requestBody: {
            label: values.label,
            value: values.value,
            limit: parseInt(values.characterLimit, 10),
            description: values.description,
            read_only: values.readonly,
            project_id: projectId,
          },
        },
        {
          onSuccess: (data: Block) => {
            if (!data.id) {
              toast.error(t('errors.createBlockError'));
              return;
            }

            void queryClient.invalidateQueries({
              queryKey: UseBlocksServiceInfiniteQuery({}).slice(0, 2),
              exact: false,
            });

            attachBlock(
              {
                agentId: currentAgentId,
                blockId: data.id,
              },
              {
                onSuccess: (nextAgentState) => {
                  // Update the query cache with the new agent state
                  queryClient.setQueriesData<AgentState | undefined>(
                    {
                      queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                        agentId: currentAgentId,
                      }),
                    },
                    () => {
                      return nextAgentState;
                    },
                  );

                  setCurrentMemoryBlock(values.label);

                  toast.success(t('success'));
                  handleOpenChange(false);
                },
                onError: () => {
                  toast.error(t('errors.attachError'));
                },
              },
            );
          },
        },
      );
    },
    [
      projectId,
      currentAgentId,
      createBlock,
      t,
      attachBlock,
      queryClient,
      setCurrentMemoryBlock,
      handleOpenChange,
      agent.id,
      blockType,
    ],
  );

  const handleExampleSelect = useCallback(
    (payload: ExampleBlockPayload) => {
      form.setValue('label', payload.label);
      form.setValue('description', payload.description);
      form.setValue('value', payload.value);
      setTab('custom');
    },
    [form],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('title')}
        testId="create-new-memory-block-dialog"
        onOpenChange={handleOpenChange}
        trigger={trigger}
        isOpen={open}
        errorMessage={errorMessage}
        isConfirmBusy={isPending}
      >
        <TabGroup
          onValueChange={(value) => {
            setTab(value as TabTypes);
          }}
          color="transparent"
          upperCase
          bold
          value={tab}
          items={[
            {
              label: t('tabs.custom'),
              value: 'custom',
            },
            {
              label: t('tabs.example'),
              value: 'example',
            },
          ]}
        />
        {tab === 'custom' ? (
          <CustomMemoryBlockForm />
        ) : (
          <ExampleBlocks
            onSelect={handleExampleSelect}
            setBlockType={setBlockType}
          />
        )}
      </Dialog>
    </FormProvider>
  );
}
