// Delete Modal as a child component
import {
  type AgentState,
  type Source,
  UseAgentsServiceRetrieveAgentKeyFn,
  useSourcesServiceDeleteSource,
} from '@letta-cloud/sdk-core';
import { useCurrentAgent } from '../../../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback } from 'react';
import { z } from 'zod';
import {
  Alert,
  Dialog,
  FormField,
  FormProvider,
  RawInput,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';

interface DeleteDataSourceDialogProps {
  source: Source;
  trigger: React.ReactNode;
  onSuccess?: VoidFunction;
}

export function DeleteDataSourceDialog(props: DeleteDataSourceDialogProps) {
  const { source, onSuccess, trigger } = props;
  const agent = useCurrentAgent();
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

  const {
    mutate: deleteSource,
    isPending: isDeleting,
    isSuccess,
    isError,
  } = useSourcesServiceDeleteSource();

  const isPending = isDeleting;

  const handleDelete = useCallback(() => {
    if (isPending || isSuccess) {
      return;
    }

    // First detach from agent, then delete
    deleteSource(
      {
        sourceId: source.id || '',
      },
      {
        onSuccess: () => {
          if (agent?.id) {
            queryClient.setQueriesData<AgentState | undefined>(
              {
                queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                  agentId: agent.id,
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
          }

          form.reset();
          setIsOpen(false);
          onSuccess?.();
        },
      },
    );
  }, [
    agent,
    deleteSource,
    form,
    isPending,
    isSuccess,
    onSuccess,
    queryClient,
    source.id,
  ]);

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={isError ? t('error') : undefined}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSubmit={form.handleSubmit(handleDelete)}
        title={t('title')}
        confirmText={t('confirm')}
        isConfirmBusy={isPending || isSuccess}
        testId="delete-data-source-dialog"
        trigger={trigger}
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
