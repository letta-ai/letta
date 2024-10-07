import { z } from 'zod';
import type { PanelTemplate } from '@letta-web/component-library';
import {
  Form,
  FormField,
  FormProvider,
  LettaLoaderPanel,
  PanelMainContent,
  RawInput,
  TextArea,
  useForm,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import type { Block } from '@letta-web/letta-agents-api';
import {
  UseAgentsServiceGetAgentKeyFn,
  useAgentsServiceUpdateAgent,
} from '@letta-web/letta-agents-api';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgent } from '../hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useCallback, useMemo } from 'react';

interface EditMemoryFormProps {
  block: Block;
}

const editMemoryBlockFormSchema = z.object({
  value: z.string(),
});

function EditMemoryForm({ block }: EditMemoryFormProps) {
  //https://linear.app/letta/issue/LET-136/infinite-loop-bug-saving-block

  const { mutate: updateAgent } = useAgentsServiceUpdateAgent();
  const queryClient = useQueryClient();
  const { id: agentId, memory } = useCurrentAgent();

  const form = useForm<z.infer<typeof editMemoryBlockFormSchema>>({
    resolver: zodResolver(editMemoryBlockFormSchema),
    defaultValues: {
      value: block.value,
    },
  });

  const handleSubmit = useCallback(
    (data: z.infer<typeof editMemoryBlockFormSchema>) => {
      const nextMemory: Record<string, Block> = {
        ...memory?.memory,
        [block.label || '']: {
          ...memory?.memory?.[block.label || ''],
          ...data,
        } as Block,
      };

      updateAgent(
        {
          agentId,
          requestBody: {
            id: agentId,
            memory: {
              ...memory,
              memory: nextMemory,
            },
          },
        },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: UseAgentsServiceGetAgentKeyFn({
                agentId,
              }),
            });
          },
        }
      );

      // mutateBlock(
      //   {
      //     blockId: block.id || '',
      //     requestBody: {
      //       id: block.id || '',
      //       value: data.value,
      //     },
      //   },
      //   {
      //     onSuccess: () => {
      //       void queryClient.invalidateQueries({
      //         queryKey: UseAgentsServiceGetAgentKeyFn({
      //           agentId,
      //         }),
      //       });
      //     },
      //   }
      // );
    },
    [
      agentId,
      // block.id,
      block.label,
      memory,
      queryClient,
      updateAgent,
    ]
  );

  return (
    <PanelMainContent>
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleSubmit)}>
          <RawInput disabled fullWidth label="Name" value={block.name || ''} />
          <RawInput
            disabled
            fullWidth
            label="Label"
            value={block.label || ''}
          />
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <TextArea
                data-testid="edit-memory-block-content"
                fullWidth
                label="Content"
                {...field}
              />
            )}
          />
        </Form>
      </FormProvider>
    </PanelMainContent>
  );
}

const EditMemoryData = z.object({
  blockId: z.string(),
  label: z.string(),
  name: z.string(),
});

type EditMemoryDataType = z.infer<typeof EditMemoryData>;

function EditMemory(props: EditMemoryDataType) {
  const { label } = props;

  const agent = useCurrentAgent();

  const data = useMemo(() => {
    return agent?.memory?.memory?.[label];
  }, [agent.memory?.memory, label]);

  return <>{!data ? <LettaLoaderPanel /> : <EditMemoryForm block={data} />}</>;
}

export const editMemoryBlocksTemplate = {
  templateId: 'edit-memory-block',
  content: EditMemory,
  useGetTitle: (data) => {
    const t = useTranslations('ADE/EditMemoryBlockPanel');

    return t('title', { blockName: data?.name });
  },
  data: EditMemoryData,
} satisfies PanelTemplate<'edit-memory-block'>;
