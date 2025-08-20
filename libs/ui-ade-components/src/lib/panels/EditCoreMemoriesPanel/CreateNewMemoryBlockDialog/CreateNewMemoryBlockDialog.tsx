import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo, useState } from 'react';
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
import { isAPIError } from '@letta-cloud/sdk-core';
import { useCurrentAgentMetaData } from '../../../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentAgent } from '../../../hooks';
import type { ExampleBlockPayload } from './ExampleBlocks';
import { ExampleBlocks } from './ExampleBlocks';
import { useSetAtom } from 'jotai/index';
import { currentAdvancedCoreMemoryAtom } from '../currentAdvancedCoreMemoryAtom';
import { useADEAppContext } from '../../../AppContext/AppContext';
import { useCreateMemoryBlock } from '../../../hooks/useCreateMemoryBlock/useCreateMemoryBlock';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { CoreMemoryBlock } from '../types';
import type { CoreMemoryBlockType } from '../types';
import { useCurrentTemplate } from '../../../hooks/useCurrentTemplate/useCurrentTemplate';

interface CreateNewMemoryBlockDialogProps {
  trigger: React.ReactNode;
}

function CustomMemoryBlockForm() {
  const t = useTranslations('CreateNewMemoryBlockDialog');
  const { isTemplate } = useCurrentAgentMetaData();

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
        id="memory-block-advanced-options"
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
                checked={field.value}
                onCheckedChange={(status) => {
                  field.onChange(status);
                }}
                label={t('readonly.label')}
                description={t('readonly.description')}
              />
            )}
          />

          {isTemplate && (
            <FormField
              name="preserveOnMigration"
              render={({ field }) => (
                <Switch
                  fullWidth
                  data-testid="memory-block-preserve-on-migration-switch"
                  checked={field.value}
                  onCheckedChange={(status) => {
                    field.onChange(status);
                  }}
                  label={t('preserveOnMigration.label')}
                  description={t('preserveOnMigration.description')}
                />
              )}
            />
          )}
        </VStack>
      </Accordion>
    </VStack>
  );
}

type TabTypes = 'custom' | 'examples';

export function CreateNewMemoryBlockDialog(
  props: CreateNewMemoryBlockDialogProps,
) {
  const { trigger } = props;
  const { projectId } = useADEAppContext();
  const [open, setOpen] = React.useState(false);
  const t = useTranslations('CreateNewMemoryBlockDialog');
  const template = useCurrentTemplate();
  const { templateId: agentTemplateId } = useCurrentAgentMetaData();

  const { agentId: currentAgentId, isTemplate } = useCurrentAgentMetaData();
  const agent = useCurrentAgent();

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
    preserveOnMigration: z.boolean().optional(),
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
      preserveOnMigration: false,
    },
  });

  const { handleCreate, isPending, error } = useCreateMemoryBlock({
    memoryType: isTemplate ? 'templated' : 'agent',
    agentId: currentAgentId,
    lettaTemplateId: template?.id || '',
    agentTemplateId,
    projectId,
    onSuccess: (createdBlock) => {
      setCurrentMemoryBlock(createdBlock);
      toast.success(t('success'));
      handleOpenChange(false);
    },
  });

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error) && error.status === 402) {
        return t.rich('errors.overage', {
          link: (chunks) => <BillingLink>{chunks}</BillingLink>,
        });
      }
      return t('errors.default');
    }
    return undefined;
  }, [error, t]);

  const handleOpenChange = useCallback(
    (nextState: boolean) => {
      setOpen(nextState);
      if (!nextState) {
        form.reset();
      }
    },
    [form],
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

      handleCreate({
        label: values.label,
        value: values.value,
        lettaTemplateId: template?.id || '',
        limit: parseInt(values.characterLimit, 10),
        description: values.description,
        readOnly: values.readonly,
        preserveOnMigration: values.preserveOnMigration,
        projectId: projectId || '',
      });
    },
    [currentAgentId, template, projectId, handleCreate, t, blockType, agent.id],
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
