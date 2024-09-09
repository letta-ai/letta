import React, { useCallback, useMemo, useState } from 'react';
import {
  ActionCard,
  Button,
  createPageRouter,
  Form,
  FormActions,
  FormField,
  FormProvider,
  Input,
  LettaLoaderPanel,
  Panel,
  PanelBar,
  PanelHeader,
  PanelPage,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { z } from 'zod';
import type { Block } from '@letta-web/letta-agents-api';
import {
  useAgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGet,
  useBlockServiceGetBlockApiBlocksBlockIdGet,
} from '@letta-web/letta-agents-api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import { useCurrentAgent } from '../hooks';

const { PanelRouter, usePanelRouteData, usePanelPageContext } =
  createPageRouter(
    {
      editMemory: {
        state: z.object({
          blockId: z.string(),
        }),
      },
      memoryHome: {
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
  name: z.string(),
  label: z
    .string()
    .regex(
      /^[a-zA-Z_][a-zA-Z0-9_-]*$/,
      'Key must be alphanumeric, and can only contain underscores and dashes'
    ),
  content: z.string(),
});

function EditMemoryForm({ block, onClose }: EditMemoryFormProps) {
  const form = useForm<z.infer<typeof editMemoryBlockFormSchema>>({
    resolver: zodResolver(editMemoryBlockFormSchema),
    defaultValues: {
      name: block.name || '',
      label: block.label || '',
      content: block.value,
    },
  });

  const handleSubmit = useCallback(
    (data: z.infer<typeof editMemoryBlockFormSchema>) => {
      console.log(data);
    },
    []
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField
          name="name"
          render={({ field }) => <Input fullWidth label="Name" {...field} />}
        />
        <FormField
          name="label"
          render={({ field }) => <Input fullWidth label="Label" {...field} />}
        />
        <FormField
          name="content"
          render={({ field }) => <Input fullWidth label="Content" {...field} />}
        />
        <FormActions>
          <Button type="button" onClick={onClose} label="Cancel" />
          <Button type="submit" label="Save" />
        </FormActions>
      </Form>
    </FormProvider>
  );
}

function EditMemory() {
  const { blockId } = usePanelRouteData<'editMemory'>();
  const { setCurrentPage } = usePanelPageContext();

  const { data } = useBlockServiceGetBlockApiBlocksBlockIdGet({
    blockId,
  });

  const handleGoBack = useCallback(() => {
    setCurrentPage('memoryHome');
  }, [setCurrentPage]);

  return (
    <PanelPage
      header={
        <PanelHeader
          title={['Memory Blocks', 'Edit Memory Block']}
          onGoBack={handleGoBack}
        />
      }
    >
      {!data ? (
        <LettaLoaderPanel />
      ) : (
        <EditMemoryForm block={data} onClose={handleGoBack} />
      )}
    </PanelPage>
  );
}

function MemoryHome() {
  const { setCurrentPage } = usePanelPageContext();
  const [search, setSearch] = useState('');
  const { id: agentId } = useCurrentAgent();
  const { data } = useAgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGet({
    agentId,
  });

  const memories = useMemo(() => {
    return data?.memory || {};
  }, [data]);

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
    <PanelPage
      header={<PanelHeader title="Memory Blocks" />}
      bar={
        <PanelBar
          searchValue={search}
          onSearch={setSearch}
          actions={
            <Button
              color="secondary"
              label="Create Memory Block"
              size="small"
            />
          }
        />
      }
    >
      {!data ? (
        <LettaLoaderPanel />
      ) : (
        <VStack padding="xxsmall">
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
    </PanelPage>
  );
}

export function MemoryBlocksPanel() {
  return (
    <Panel
      id={['sidebar', 'memory-blocks']}
      trigger={<ADENavigationItem title="Memory Blocks" />}
    >
      <PanelRouter
        pages={{
          memoryHome: <MemoryHome />,
          editMemory: <EditMemory />,
        }}
      />
    </Panel>
  );
}
