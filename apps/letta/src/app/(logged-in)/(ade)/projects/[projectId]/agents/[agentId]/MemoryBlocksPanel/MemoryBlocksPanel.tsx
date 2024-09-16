import React, { useCallback, useMemo, useState } from 'react';
import {
  ActionCard,
  Button,
  createPageRouter,
  Form,
  FormActions,
  FormField,
  FormProvider,
  LettaLoaderPanel,
  Panel,
  PanelBar,
  PanelElementsList,
  RawInput,
  TextArea,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { z } from 'zod';
import type { Block } from '@letta-web/letta-agents-api';
import { useAgentsServiceUpdateAgent } from '@letta-web/letta-agents-api';
import {
  UseAgentsServiceGetAgentKeyFn,
  useBlocksServiceUpdateMemoryBlock,
} from '@letta-web/letta-agents-api';
import { useBlocksServiceGetMemoryBlock } from '@letta-web/letta-agents-api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import { useCurrentAgent } from '../hooks';
import { useQueryClient } from '@tanstack/react-query';

const { PanelRouter, usePanelRouteData, usePanelPageContext } =
  createPageRouter(
    {
      editMemory: {
        title: 'Edit',
        state: z.object({
          blockId: z.string(),
        }),
      },
      memoryHome: {
        title: 'Memory Blocks',
        state: z.object({}),
      },
    },
    {
      initialPage: 'memoryHome',
    }
  );

//
// function DeleteMemoryDialog() {
//   const [isOpen, setIsOpen] = useState(false);
//
//   return (
//     <Dialog
//       onOpenChange={setIsOpen}
//       isOpen={isOpen}
//       title="Delete Variable"
//       confirmColor="destructive"
//       trigger={<Button label="Delete Variable" color="destructive" />}
//       confirmText="Delete"
//       onConfirm={() => {
//         console.log('Delete');
//       }}
//       cancelText="Cancel"
//     >
//       Are you sure you want to delete this memory block? It cannot be undone.
//     </Dialog>
//   );
// }

interface EditMemoryFormProps {
  block: Block;
  onClose: VoidFunction;
}

const editMemoryBlockFormSchema = z.object({
  value: z.string(),
});

function EditMemoryForm({ block, onClose }: EditMemoryFormProps) {
  const { mutate: mutateBlock, isPending: isPendingMutateBlock } =
    useBlocksServiceUpdateMemoryBlock();

  const { mutate: updateAgent, isPending: isUpdatingAgent } =
    useAgentsServiceUpdateAgent();
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

      updateAgent({
        agentId,
        requestBody: {
          id: agentId,
          memory: {
            ...memory,
            memory: nextMemory,
          },
        },
      });

      mutateBlock(
        {
          blockId: block.id || '',
          requestBody: {
            id: block.id || '',
            value: data.value,
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
    },
    [
      agentId,
      block.id,
      block.label,
      memory,
      mutateBlock,
      queryClient,
      updateAgent,
    ]
  );

  return (
    <PanelElementsList>
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
            name="value"
            render={({ field }) => (
              <TextArea fullWidth label="Content" {...field} />
            )}
          />
          <FormActions>
            <Button
              color="tertiary"
              type="button"
              onClick={onClose}
              label="Cancel"
            />
            <Button
              color="secondary"
              type="submit"
              busy={isPendingMutateBlock || isUpdatingAgent}
              label="Save"
            />
          </FormActions>
        </Form>
      </FormProvider>
    </PanelElementsList>
  );
}

function EditMemory() {
  const { blockId } = usePanelRouteData<'editMemory'>();
  const { setCurrentPage } = usePanelPageContext();

  const handleGoBack = useCallback(() => {
    setCurrentPage('memoryHome', {});
  }, [setCurrentPage]);

  const { data } = useBlocksServiceGetMemoryBlock({
    blockId,
  });

  return (
    <>
      {!data ? (
        <LettaLoaderPanel />
      ) : (
        <EditMemoryForm block={data} onClose={handleGoBack} />
      )}
    </>
  );
}

function MemoryHome() {
  const { setCurrentPage } = usePanelPageContext();
  const [search, setSearch] = useState('');
  const { memory } = useCurrentAgent();

  const memories = useMemo(() => {
    return memory?.memory || {};
  }, [memory]);

  const memoriesList = useMemo(() => {
    return Object.values(memories).filter((m) =>
      (m.name || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [memories, search]);

  const handleEdit = useCallback(
    (blockId: string) => {
      setCurrentPage('editMemory', { blockId });
    },
    [setCurrentPage]
  );

  return (
    <>
      <PanelBar
        searchValue={search}
        onSearch={setSearch}
        actions={
          <Button color="secondary" label="Create Memory Block" size="small" />
        }
      />
      {!memory ? (
        <LettaLoaderPanel />
      ) : (
        <VStack overflowY="auto" collapseHeight padding="small">
          {memoriesList.map((block) => (
            <ActionCard
              title={block.name || 'Unnamed Block'}
              subtitle={block.label || ''}
              key={block.id}
              mainAction={
                <Button
                  size="small"
                  color="tertiary"
                  label="Edit"
                  onClick={() => {
                    if (block.id) {
                      handleEdit(block.id);
                    }
                  }}
                />
              }
              description={block.value}
            ></ActionCard>
          ))}
        </VStack>
      )}
    </>
  );
}

export function MemoryBlocksPanel() {
  return (
    <Panel
      id="memory-blocks-panel"
      trigger={<ADENavigationItem title="Memory Blocks" />}
    >
      <PanelRouter
        rootPageKey="memoryHome"
        pages={{
          memoryHome: <MemoryHome />,
          editMemory: <EditMemory />,
        }}
      />
    </Panel>
  );
}
