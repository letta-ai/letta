import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import {
  type Source,
  isAPIError,
  useSourcesServiceModifySource,
  type AgentState,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import {
  Dialog,
  FormField,
  FormProvider,
  RawInput,
  useForm,
} from '@letta-cloud/ui-component-library';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentAgent } from '../../../../../hooks';

const renameDataSourceSchema = z.object({
  name: z.string().min(1),
});

type RenameDataSourceFormValues = z.infer<typeof renameDataSourceSchema>;

interface RenameDataSourceDialogProps {
  source: Source;
  trigger: React.ReactNode;
  onSuccess?: VoidFunction;
}

export function RenameDataSourceDialog(props: RenameDataSourceDialogProps) {
  const { source, trigger, onSuccess } = props;
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

  const { mutate, isPending, error, reset } = useSourcesServiceModifySource({
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

      if (onSuccess) {
        onSuccess();
      }
    },
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        form.reset();
        reset();
      }
    },
    [form, reset, setIsOpen],
  );

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error)) {
        if (error.status === 409) {
          return t('errors.conflict');
        }
      }

      return t('errors.default');
    }

    return undefined;
  }, [error, t]);

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
        errorMessage={errorMessage}
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('title')}
        confirmText={t('confirm')}
        isConfirmBusy={isPending}
        testId="rename-data-source-dialog"
        trigger={trigger}
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
