import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback } from 'react';
import type { Source } from '@letta-cloud/sdk-core';
import {
  Button,
  VerticalDotsIcon,
  TrashIcon,
  EditIcon,
  DatabaseIcon,
  DropdownMenu,
  DropdownMenuItem,
  Dialog,
  Typography,
  Alert,
  FormField,
  FormProvider,
  RawInput,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import {
  type AgentState,
  useAgentsServiceDetachSourceFromAgent,
  useSourcesServiceDeleteSource,
  useSourcesServiceModifySource,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentAgent } from '../../../../hooks';

// Rename Modal as a child component
const renameDataSourceSchema = z.object({
  name: z.string().min(1),
});

type RenameDataSourceFormValues = z.infer<typeof renameDataSourceSchema>;

function RenameDataSourceDialog({ source }: { source: Source }) {
  const t = useTranslations('ADE/EditDataSourcesPanel.RenameDataSourceModal');
  const queryClient = useQueryClient();
  const { id: agentId } = useCurrentAgent();
  const [isOpen, setIsOpen] = React.useState(false);

  const form = useForm<RenameDataSourceFormValues>({
    resolver: zodResolver(renameDataSourceSchema),
    defaultValues: {
      name: source.name,
    },
  });

  const { mutate, isPending, isError } = useSourcesServiceModifySource({
    onSuccess: (response) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            sources: oldData.sources.map((currentSource) => {
              if (currentSource.id === source.id) {
                return {
                  ...currentSource,
                  name: response.name,
                };
              }

              return currentSource;
            }),
          };
        },
      );

      form.reset();
      setIsOpen(false);
    },
  });

  const handleSubmit = useCallback(
    (values: RenameDataSourceFormValues) => {
      mutate({
        sourceId: source.id || '',
        requestBody: {
          name: values.name.trim(),
        },
      });
    },
    [mutate, source.id],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={isError ? t('error') : undefined}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('title')}
        confirmText={t('confirm')}
        isConfirmBusy={isPending}
        testId="rename-data-source-dialog"
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            preIcon={<EditIcon />}
            label={t('trigger')}
          />
        }
      >
        <FormField
          render={({ field }) => (
            <RawInput
              fullWidth
              {...field}
              hideLabel
              size="small"
              label={t('name.label')}
              placeholder={t('name.placeholder')}
              data-testid="rename-data-source-input"
            />
          )}
          name="name"
        />
      </Dialog>
    </FormProvider>
  );
}

// Detach Modal as a child component
function DetachDataSourceDialog({ source }: { source: Source }) {
  const { id: agentId } = useCurrentAgent();
  const t = useTranslations('ADE/EditDataSourcesPanel.DetachDataSourceModal');
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);

  const {
    mutate: detachSource,
    isError,
    isPending,
  } = useAgentsServiceDetachSourceFromAgent({
    onSuccess: (_, variables: { agentId: string; sourceId: string }) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            sources: oldData.sources.filter(
              (currentSource) => currentSource.id !== variables.sourceId,
            ),
          };
        },
      );

      setIsOpen(false);
    },
  });

  const handleDetach = useCallback(() => {
    detachSource({
      agentId,
      sourceId: source.id || '',
    });
  }, [agentId, detachSource, source.id]);

  return (
    <Dialog
      onOpenChange={setIsOpen}
      isOpen={isOpen}
      testId="detach-data-source-dialog"
      title={t('title', { sourceName: source.name })}
      confirmText={t('confirm')}
      isConfirmBusy={isPending}
      onConfirm={handleDetach}
      errorMessage={isError ? t('error') : undefined}
      trigger={
        <DropdownMenuItem
          doNotCloseOnSelect
          preIcon={<DatabaseIcon />}
          label={t('trigger')}
        />
      }
    >
      <Typography>{t('areYouSure', { sourceName: source.name })}</Typography>
    </Dialog>
  );
}

// Delete Modal as a child component
function DeleteDataSourceDialog({ source }: { source: Source }) {
  const { id: agentId } = useCurrentAgent();
  const t = useTranslations('ADE/EditDataSourcesPanel.DeleteDataSourceModal');
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);

  const deleteDataSourceSchema = z.object({
    confirmName: z.string().refine((value) => value === source.name, {
      message: t('confirmName.error'),
    }),
  });

  type DeleteDataSourceFormValues = z.infer<typeof deleteDataSourceSchema>;

  const form = useForm<DeleteDataSourceFormValues>({
    resolver: zodResolver(deleteDataSourceSchema),
    defaultValues: {
      confirmName: '',
    },
  });

  const { mutate: detachSource, isPending: isDetaching } =
    useAgentsServiceDetachSourceFromAgent();
  const {
    mutate: deleteSource,
    isPending: isDeleting,
    isError,
  } = useSourcesServiceDeleteSource();

  const isPending = isDetaching || isDeleting;

  const handleDelete = useCallback(() => {
    // First detach from agent, then delete
    detachSource(
      {
        agentId,
        sourceId: source.id || '',
      },
      {
        onSuccess: () => {
          deleteSource(
            {
              sourceId: source.id || '',
            },
            {
              onSuccess: () => {
                queryClient.setQueriesData<AgentState | undefined>(
                  {
                    queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                      agentId,
                    }),
                  },
                  (oldData) => {
                    if (!oldData) {
                      return oldData;
                    }
                    return {
                      ...oldData,
                      sources: oldData.sources.filter(
                        (currentSource) => currentSource.id !== source.id,
                      ),
                    };
                  },
                );

                form.reset();
                setIsOpen(false);
              },
            },
          );
        },
      },
    );
  }, [agentId, deleteSource, detachSource, form, queryClient, source.id]);

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={isError ? t('error') : undefined}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSubmit={form.handleSubmit(handleDelete)}
        title={t('title')}
        confirmText={t('confirm')}
        isConfirmBusy={isPending}
        testId="delete-data-source-dialog"
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            preIcon={<TrashIcon />}
            label={t('trigger')}
          />
        }
      >
        <VStack gap="form">
          <Alert
            title={t('description', {
              sourceName: source.name,
            })}
            variant="destructive"
          />
          <FormField
            render={({ field }) => (
              <RawInput
                fullWidth
                {...field}
                size="small"
                label={t('confirmName.label')}
                placeholder={source.name}
                data-testid="delete-data-source-confirm-input"
              />
            )}
            name="confirmName"
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

export interface DatasourceDropdownMenuProps {
  source: Source;
  trigger?: React.ReactNode;
}

export function DatasourceDropdownMenu(props: DatasourceDropdownMenuProps) {
  const { source, trigger } = props;
  const t = useTranslations('ADE/EditDataSourcesPanel.DatasourceDropdownMenu');

  return (
    <DropdownMenu
      triggerAsChild
      className="bg-background-grey"
      align="start"
      trigger={
        trigger || (
          <Button
            color="tertiary"
            size="xsmall"
            hideLabel
            label={t('menuLabel')}
            preIcon={<VerticalDotsIcon />}
          />
        )
      }
    >
      <RenameDataSourceDialog source={source} />
      <DetachDataSourceDialog source={source} />
      <DeleteDataSourceDialog source={source} />
    </DropdownMenu>
  );
}
