'use client';
import React, { useCallback, useMemo, useState } from 'react';
import type { PanelTemplate } from '@letta-web/component-library';
import {
  CopyButton,
  HStack,
  RawTextArea,
  Typography,
} from '@letta-web/component-library';
import { ThoughtsIcon } from '@letta-web/component-library';
import { PlusIcon } from '@letta-web/component-library';
import {
  ActionCard,
  Alert,
  Button,
  Dialog,
  FormField,
  FormProvider,
  LettaLoaderPanel,
  PanelBar,
  PanelMainContent,
  TextArea,
  TrashIcon,
  useForm,
} from '@letta-web/component-library';
import { z } from 'zod';
import type {
  ListAgentArchivalMemoryResponse,
  Passage,
} from '@letta-web/letta-agents-api';
import {
  useAgentsServiceCreateAgentArchivalMemory,
  useAgentsServiceDeleteAgentArchivalMemory,
  useAgentsServiceListAgentArchivalMemory,
  UseAgentsServiceListAgentArchivalMemoryKeyFn,
} from '@letta-web/letta-agents-api';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useCurrentSimulatedAgent } from '../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { useDateFormatter } from '@letta-web/helpful-client-utils';

interface ViewArchivalMemoryDialogProps {
  memory: Passage;
}

function ViewArchivalMemoryDialog(props: ViewArchivalMemoryDialogProps) {
  const { memory } = props;
  const t = useTranslations('ADE/ArchivalMemories');

  return (
    <Dialog
      disableForm
      hideConfirm
      trigger={
        <button>
          <Typography color="primary" underline overrideEl="span">
            {t('ViewArchivalMemoryDialog.trigger')}
          </Typography>
        </button>
      }
      title={t('ViewArchivalMemoryDialog.title')}
    >
      <RawTextArea
        resize="none"
        fullHeight
        fullWidth
        disabled
        hideLabel
        label={t('ViewArchivalMemoryDialog.label')}
        value={memory.text}
        readOnly
      />
      <HStack>
        <CopyButton
          copyButtonText={t('ViewArchivalMemoryDialog.copyText')}
          textToCopy={memory.text}
        />
      </HStack>
    </Dialog>
  );
}

interface MemoryItemProps {
  memory: Passage;
}

const MAX_MEMORY_LENGTH = 180;

function MemoryItem(props: MemoryItemProps) {
  const { id: currentAgentId } = useCurrentSimulatedAgent();

  const { memory } = props;
  const [open, setOpen] = useState(false);

  const queryClient = useQueryClient();

  const t = useTranslations('ADE/ArchivalMemories');

  const { formatDate } = useDateFormatter();

  const { mutate: deleteMemory, isPending: isDeletingMemory } =
    useAgentsServiceDeleteAgentArchivalMemory({
      onSuccess: async () => {
        setOpen(false);
        queryClient.setQueriesData<ListAgentArchivalMemoryResponse | undefined>(
          {
            queryKey: UseAgentsServiceListAgentArchivalMemoryKeyFn({
              agentId: currentAgentId,
            }),
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              data: oldData.filter((memory) => memory.id !== memory.id),
            };
          }
        );
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
      title={t('MemoryItem.memoryText', {
        date: formatDate(memory?.created_at || ''),
      })}
      mainAction={
        <HStack gap="small">
          <CopyButton
            size="small"
            hideLabel
            copyButtonText={t('MemoryItem.copyText')}
            textToCopy={memory.text}
          />
          <Dialog
            onOpenChange={setOpen}
            isOpen={open}
            trigger={
              <Button
                label={t('MemoryItem.deleteMemory')}
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
            confirmText={t('MemoryItem.deleteConfirm')}
            cancelText="Cancel"
            title="Delete Memory"
          >
            {t('MemoryItem.deleteConfirmation')}
          </Dialog>
        </HStack>
      }
    >
      <Typography variant="body">
        {memory.text.slice(0, MAX_MEMORY_LENGTH)}
        {memory.text.length > MAX_MEMORY_LENGTH ? (
          <ViewArchivalMemoryDialog memory={memory} />
        ) : (
          ''
        )}
      </Typography>
    </ActionCard>
  );
}

function MemoriesList() {
  const { id: currentAgentId } = useCurrentSimulatedAgent();

  const { data, isLoading } = useAgentsServiceListAgentArchivalMemory(
    {
      agentId: currentAgentId,
    },
    undefined,
    {
      enabled: !!currentAgentId,
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
            <CreateMemoryDialog />
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

function CreateMemoryDialog() {
  const { id: currentAgentId } = useCurrentSimulatedAgent();
  const queryClient = useQueryClient();
  const t = useTranslations('ADE/ArchivalMemories');
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useAgentsServiceCreateAgentArchivalMemory({
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({
        queryKey: UseAgentsServiceListAgentArchivalMemoryKeyFn({
          agentId: currentAgentId,
        }),
      });
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
      <Dialog
        onOpenChange={setOpen}
        isOpen={open}
        size="large"
        isConfirmBusy={isPending}
        trigger={
          <Button
            hideLabel
            preIcon={<PlusIcon />}
            color="tertiary"
            label={t('CreateMemoryDialog.trigger')}
          />
        }
        title={t('CreateMemoryDialog.title')}
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <Alert variant="info" title={t('CreateMemoryDialog.info')} />
        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <TextArea
              placeholder={t('CreateMemoryDialog.placeholder')}
              fullWidth
              label={t('CreateMemoryDialog.label')}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

export const archivalMemoriesPanelTemplate = {
  templateId: 'archival-memories',
  icon: <ThoughtsIcon />,
  useGetTitle: () => {
    const t = useTranslations('ADE/ArchivalMemories');
    const { id: currentAgentId } = useCurrentSimulatedAgent();

    const { data, isLoading } = useAgentsServiceListAgentArchivalMemory(
      {
        agentId: currentAgentId,
      },
      undefined,
      {
        enabled: !!currentAgentId,
      }
    );

    const count = useMemo(() => {
      if (!data || isLoading) {
        return '-';
      }

      return data.length;
    }, [data, isLoading]);

    return t('title', { count });
  },
  useGetInfoTooltipText: () => {
    const t = useTranslations('ADE/ArchivalMemories');

    return t('infoTooltip');
  },
  useGetMobileTitle: () => {
    const t = useTranslations('ADE/ArchivalMemories');

    return t('mobileTitle');
  },
  content: MemoryRootPage,
  data: z.object({}),
} satisfies PanelTemplate<'archival-memories'>;
