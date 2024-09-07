import React, { useCallback, useMemo, useState } from 'react';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import {
  ActionCard,
  Button,
  createPageRouter,
  Dialog,
  LettaLoaderPanel,
  Panel,
  PanelBar,
  PanelHeader,
  PanelLastElement,
  TrashIcon,
} from '@letta-web/component-library';
import { z } from 'zod';
import type { Passage } from '@letta-web/letta-agents-api';
import {
  useAgentsServiceDeleteAgentArchivalMemoryApiAgentsAgentIdArchivalMemoryIdDelete,
  useAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGet,
  UseAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetKeyFn,
} from '@letta-web/letta-agents-api';
import { useCurrentAgentId } from '../hooks';
import { useQueryClient } from '@tanstack/react-query';

const { PanelRouter, usePanelPageContext } = createPageRouter(
  {
    createMemory: {
      state: z.object({}),
    },
    memory: {
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
  const currentAgentId = useCurrentAgentId();

  const { memory } = props;
  const [open, setOpen] = useState(false);

  const queryClient = useQueryClient();

  const { mutate: deleteMemory, isPending: isDeletingMemory } =
    useAgentsServiceDeleteAgentArchivalMemoryApiAgentsAgentIdArchivalMemoryIdDelete(
      {
        onSuccess: async () => {
          setOpen(false);
          await queryClient.invalidateQueries({
            queryKey:
              UseAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetKeyFn(
                {
                  agentId: currentAgentId,
                }
              ),
          });
        },
      }
    );

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
  const currentAgentId = useCurrentAgentId();

  const { data, isLoading } =
    useAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGet({
      agentId: currentAgentId,
    });

  const allMemories = useMemo(() => {
    return data || [];
  }, [data]);

  if (isLoading) {
    return <LettaLoaderPanel />;
  }

  return (
    <PanelLastElement>
      {allMemories.map((memory) => {
        return <MemoryItem key={memory.id} memory={memory} />;
      })}
    </PanelLastElement>
  );
}

function MemoryRootPage() {
  const { setCurrentPage } = usePanelPageContext();
  const [search, setSearch] = useState('');

  return (
    <>
      <PanelHeader title="Archival Memories" />
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
              color="secondary"
              label="Create Memory"
            />
          </>
        }
      />
      <MemoriesList />
    </>
  );
}

function CreateMemoryPage() {
  const { setCurrentPage } = usePanelPageContext();

  return (
    <div>
      <PanelHeader
        onGoBack={() => {
          setCurrentPage('memory');
        }}
        title={['Archival Memories', 'Create Memory']}
      />
    </div>
  );
}

export function ArchivalMemoriesPanel() {
  return (
    <Panel
      width="compact"
      id={['sidebar', 'archival-memories']}
      trigger={<ADENavigationItem title="Archival Memories" />}
    >
      <PanelRouter
        pages={{
          memory: <MemoryRootPage />,
          createMemory: <CreateMemoryPage />,
        }}
      />
    </Panel>
  );
}
