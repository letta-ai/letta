'use client';
import React, { useCallback, useMemo, useState } from 'react';
import type { PanelTemplate } from '@letta-web/component-library';
import {
  ActionCard,
  Alert,
  Button,
  createPageRouter,
  Dialog,
  Form,
  FormField,
  FormProvider,
  HStack,
  LettaLoaderPanel,
  PanelBar,
  PanelMainContent,
  TextArea,
  TrashIcon,
  useForm,
} from '@letta-web/component-library';
import { z } from 'zod';
import type { Passage } from '@letta-web/letta-agents-api';
import {
  useAgentsServiceCreateAgentArchivalMemory,
  useAgentsServiceDeleteAgentArchivalMemory,
  useAgentsServiceListAgentArchivalMemory,
  UseAgentsServiceListAgentArchivalMemoryKeyFn,
} from '@letta-web/letta-agents-api';
import { useCurrentAgent } from '../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';

const { PanelRouter, usePanelPageContext } = createPageRouter(
  {
    createMemory: {
      title: 'Create Memory',
      state: z.object({}),
    },
    memory: {
      title: 'Memories',
      state: z.object({}),
    },
  },
  {
    initialPage: 'memory',
  }
);

interface MemoryItemProps {
  memory: Passage;
}

function MemoryItem(props: MemoryItemProps) {
  const { id: currentAgentId } = useCurrentAgent();

  const { memory } = props;
  const [open, setOpen] = useState(false);

  const queryClient = useQueryClient();

  const { mutate: deleteMemory, isPending: isDeletingMemory } =
    useAgentsServiceDeleteAgentArchivalMemory({
      onSuccess: async () => {
        setOpen(false);
        await queryClient.invalidateQueries({
          queryKey: UseAgentsServiceListAgentArchivalMemoryKeyFn({
            agentId: currentAgentId,
          }),
        });
      },
    });

  const handleRemoveMemory = useCallback(
    (memoryId: string) => {
      deleteMemory({
        agentId: currentAgentId,
        memoryId,
      });
    },
    [currentAgentId, deleteMemory]
  );

  return (
    <ActionCard
      key={memory.id}
      title={`Memory at ${memory.created_at}`}
      description={memory.text.slice(0, 180)}
      mainAction={
        <Dialog
          onOpenChange={setOpen}
          isOpen={open}
          trigger={
            <Button
              label="Remove Memory"
              color="tertiary"
              preIcon={<TrashIcon />}
              hideLabel
              type="button"
              size="small"
            />
          }
          isConfirmBusy={isDeletingMemory}
          onConfirm={() => {
            handleRemoveMemory(memory.id || '');
          }}
          confirmText="Delete Memory"
          cancelText="Cancel"
          title="Delete Memory"
        >
          Are you sure you want to delete this memory? It will be permanently
          removed.
        </Dialog>
      }
    />
  );
}

function MemoriesList() {
  const { id: currentAgentId } = useCurrentAgent();

  const { data, isLoading } = useAgentsServiceListAgentArchivalMemory(
    {
      agentId: currentAgentId,
    },
    undefined,
    {
      refetchInterval: 5000,
    }
  );

  const allMemories = useMemo(() => {
    return data || [];
  }, [data]);

  if (isLoading) {
    return <LettaLoaderPanel />;
  }

  return (
    <PanelMainContent>
      {allMemories.map((memory) => {
        return <MemoryItem key={memory.id} memory={memory} />;
      })}
    </PanelMainContent>
  );
}

function MemoryRootPage() {
  const { setCurrentPage } = usePanelPageContext();
  const [search, setSearch] = useState('');

  return (
    <>
      <PanelBar
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
        }}
        actions={
          <>
            <Button
              onClick={() => {
                setCurrentPage('createMemory');
              }}
              size="small"
              color="primary"
              label="Create Memory"
            />
          </>
        }
      />
      <MemoriesList />
    </>
  );
}

const createMemorySchema = z.object({
  text: z.string(),
});

function CreateMemoryPage() {
  const { id: currentAgentId } = useCurrentAgent();
  const { setCurrentPage } = usePanelPageContext();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useAgentsServiceCreateAgentArchivalMemory({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: UseAgentsServiceListAgentArchivalMemoryKeyFn({
          agentId: currentAgentId,
        }),
      });
      setCurrentPage('memory');
    },
  });

  const form = useForm<z.infer<typeof createMemorySchema>>({
    resolver: zodResolver(createMemorySchema),
    defaultValues: {
      text: '',
    },
  });

  const handleSubmit = useCallback(
    (values: z.infer<typeof createMemorySchema>) => {
      mutate({
        agentId: currentAgentId,
        requestBody: {
          text: values.text,
        },
      });
    },
    [currentAgentId, mutate]
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <PanelMainContent>
          <Alert variant="info" title="Info">
            An agent memory is a passage of text that the agent can remember and
            refer back to. This content will not be transferred when staging an
            agent. If you want to create a memory that will be transferred, use
            the Core Memory section.
          </Alert>
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <TextArea
                placeholder="Enter memory text here"
                fullWidth
                label="Memory"
                {...field}
              />
            )}
          />
          <HStack fullWidth justify="end">
            <Button
              type="submit"
              label="Create"
              color="primary"
              busy={isPending}
            />
          </HStack>
        </PanelMainContent>
      </Form>
    </FormProvider>
  );
}

export function ArchivalMemoriesPanel() {
  return (
    <PanelRouter
      rootPageKey="memory"
      pages={{
        memory: <MemoryRootPage />,
        createMemory: <CreateMemoryPage />,
      }}
    />
  );
}

export const archivalMemoriesPanelTemplate = {
  templateId: 'archival-memories',
  useGetTitle: () => 'Archival Memories',
  content: ArchivalMemoriesPanel,
  data: z.object({}),
} satisfies PanelTemplate<'archival-memories'>;
