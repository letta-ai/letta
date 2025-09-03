'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { LoadingEmptyStatusComponent } from '@letta-cloud/ui-component-library';
import {
  CopyButton,
  HStack,
  RawTextArea,
  Typography,
} from '@letta-cloud/ui-component-library';
import { PlusIcon } from '@letta-cloud/ui-component-library';
import {
  ActionCard,
  Alert,
  Button,
  Dialog,
  FormField,
  FormProvider,
  PanelBar,
  PanelMainContent,
  TextArea,
  TrashIcon,
  useForm,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { AgentsService } from '@letta-cloud/sdk-core';
import type { ListPassagesResponse, Passage } from '@letta-cloud/sdk-core';
import {
  useAgentsServiceCreatePassage,
  useAgentsServiceDeletePassage,
  useAgentsServiceListPassages,
  UseAgentsServiceListPassagesKeyFn,
} from '@letta-cloud/sdk-core';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from '@letta-cloud/translations';
import { useFormatters } from '@letta-cloud/utils-client';
import { useCurrentSimulatedAgent } from '../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { useCurrentAgentMetaData } from '../../../hooks';
import { useADEPermissions } from '../../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useDebouncedValue } from '@mantine/hooks';
import type { InfiniteData } from '@tanstack/query-core';
import { useNetworkInspector } from '../../../hooks/useNetworkInspector/useNetworkInspector';

function UseInfiniteAgentPassagesQueryFn(
  args: Parameters<typeof UseAgentsServiceListPassagesKeyFn>,
) {
  return ['infinite', ...UseAgentsServiceListPassagesKeyFn(...args)];
}

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
          <Typography underline overrideEl="span">
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

  const { formatDateAndTime } = useFormatters();

  const { handleInspectErrorWithClose } = useNetworkInspector();
  function handleInspectError() {
    function closeDialog() {
      setOpen(false);
    }
    handleInspectErrorWithClose(closeDialog);
  }

  const {
    mutate: deleteMemory,
    isPending: isDeletingMemory,
    isError,
    reset,
  } = useAgentsServiceDeletePassage({
    onSuccess: async () => {
      setOpen(false);
      queryClient.setQueriesData<
        InfiniteData<ListPassagesResponse> | undefined
      >(
        {
          queryKey: UseInfiniteAgentPassagesQueryFn([
            {
              agentId: currentAgentId,
            },
          ]).slice(0, 2),
          exact: false,
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            pages: oldData.pages.map((p) =>
              p.filter((m) => m.id !== memory.id),
            ),
          };
        },
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
    [currentAgentId, deleteMemory],
  );

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  function handleDialogOpenChange(open: boolean) {
    setOpen(open);
    if (!open) {
      reset();
    }
  }

  return (
    <ActionCard
      color="transparent"
      key={memory.id}
      title={t('MemoryItem.memoryText', {
        date: formatDateAndTime(memory?.created_at || ''),
      })}
      mainAction={
        <HStack gap="small">
          <CopyButton
            size="small"
            hideLabel
            copyButtonText={t('MemoryItem.copyText')}
            textToCopy={memory.text}
          />
          {canUpdateAgent && (
            <Dialog
              errorMessage={isError ? t('MemoryItem.error') : undefined}
              errorMessageAction={
                isError ? (
                  <Button
                    size="xsmall"
                    label="Inspect Error"
                    color="tertiary"
                    onClick={handleInspectError}
                  />
                ) : undefined
              }
              onOpenChange={handleDialogOpenChange}
              isOpen={open}
              trigger={
                <Button
                  label={t('MemoryItem.deleteMemory')}
                  color="secondary"
                  preIcon={<TrashIcon />}
                  hideLabel
                  type="button"
                  size="small"
                />
              }
              isConfirmBusy={isDeletingMemory}
              onConfirm={() => {
                const memoryId = memory.id || '';
                handleRemoveMemory(memoryId);
              }}
              confirmText={t('MemoryItem.deleteConfirm')}
              cancelText="Cancel"
              title="Delete Memory"
            >
              {t('MemoryItem.deleteConfirmation')}
            </Dialog>
          )}
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

interface MemoriesListProps {
  search: string;
}

function MemoriesList(props: MemoriesListProps) {
  const { search } = props;
  const { simulatedAgentId } = useCurrentSimulatedAgent();
  const { agentId: normalAgentId, isTemplate } = useCurrentAgentMetaData();

  const agentId = isTemplate ? simulatedAgentId : normalAgentId;

  const limit = 5;

  const [debouncedSearch] = useDebouncedValue(search, 500);

  const t = useTranslations('ADE/ArchivalMemories');
  const { data, isFetchingNextPage, hasNextPage, isLoading, fetchNextPage } =
    useInfiniteQuery<
      ListPassagesResponse,
      unknown,
      InfiniteData<ListPassagesResponse>,
      unknown[],
      { after?: string | null }
    >({
      queryKey: UseInfiniteAgentPassagesQueryFn([
        {
          agentId: agentId || '',
          limit: limit + 1,
          search: debouncedSearch,
        },
      ]),
      queryFn: ({ pageParam }) => {
        return AgentsService.listPassages({
          limit: limit + 1,
          after: pageParam?.after,
          search: debouncedSearch,
          agentId: agentId || '',
        });
      },
      refetchInterval: 10000,
      initialPageParam: { after: null },
      getNextPageParam: (lastPage) => {
        if (lastPage.length > limit) {
          return {
            after: lastPage[lastPage.length - 2].id,
          };
        }

        return undefined;
      },
      enabled: !!limit && !!agentId,
    });

  const allMemories = useMemo(() => {
    return data?.pages.flatMap((page) => page.slice(0, limit)) || [];
  }, [data]);

  if (isLoading || !agentId) {
    return (
      <LoadingEmptyStatusComponent
        noMinHeight
        hideText
        loaderVariant="grower"
        isLoading
      />
    );
  }

  return (
    <PanelMainContent>
      {allMemories.map((memory) => {
        return <MemoryItem key={memory.id} memory={memory} />;
      })}
      {hasNextPage && (
        <Button
          fullWidth
          onClick={() => {
            void fetchNextPage();
          }}
          label={t('loadMore')}
          busy={isFetchingNextPage}
        ></Button>
      )}
    </PanelMainContent>
  );
}

export function ArchivalMemoriesPanel() {
  const [search, setSearch] = useState('');
  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  return (
    <>
      <PanelBar
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
        }}
        actions={
          canUpdateAgent && (
            <>
              <CreateMemoryDialog />
            </>
          )
        }
      />
      <MemoriesList search={search} />
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
  const { isTemplate } = useCurrentAgentMetaData();

  const form = useForm<z.infer<typeof createMemorySchema>>({
    resolver: zodResolver(createMemorySchema),
    defaultValues: {
      text: '',
    },
  });
  const { mutate, isPending, reset } = useAgentsServiceCreatePassage({
    onSuccess: async () => {
      handleOpen(false);
      await queryClient.invalidateQueries({
        queryKey: UseInfiniteAgentPassagesQueryFn([
          {
            agentId: currentAgentId,
          },
        ]).slice(0, 1),
        exact: false,
      });
    },
  });

  const handleOpen = useCallback(
    (open: boolean) => {
      if (!open) {
        form.reset();
        reset();
      }

      setOpen(open);
    },
    [form, reset],
  );

  const handleSubmit = useCallback(
    (values: z.infer<typeof createMemorySchema>) => {
      mutate({
        agentId: currentAgentId,
        requestBody: {
          text: values.text,
        },
      });
    },
    [currentAgentId, mutate],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={handleOpen}
        isOpen={open}
        size="large"
        isConfirmBusy={isPending}
        trigger={
          <Button
            hideLabel
            preIcon={<PlusIcon />}
            color="secondary"
            label={t('CreateMemoryDialog.trigger')}
          />
        }
        title={t('CreateMemoryDialog.title')}
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        {isTemplate && (
          <Alert variant="info" title={t('CreateMemoryDialog.info')} />
        )}
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

export function useArchivalMemoriesTitle() {
  const t = useTranslations('ADE/ArchivalMemories');
  const { simulatedAgentId } = useCurrentSimulatedAgent();
  const { agentId: normalAgentId, isTemplate } = useCurrentAgentMetaData();

  const agentId = isTemplate ? simulatedAgentId : normalAgentId;

  const { data, isLoading } = useAgentsServiceListPassages(
    {
      agentId: agentId || '',
      limit: 21,
      ascending: false,
    },
    undefined,
    {
      refetchInterval: 10000,
      enabled: !!agentId,
    },
  );

  const count = useMemo(() => {
    if (!data || isLoading) {
      return '-';
    }

    if (data.length > 20) {
      return '20+';
    }

    return data.length;
  }, [data, isLoading]);

  return t('title', { count });
}
