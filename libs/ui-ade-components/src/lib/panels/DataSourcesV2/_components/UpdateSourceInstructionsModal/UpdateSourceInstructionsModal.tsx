import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback } from 'react';
import {
  type AgentState,
  type Source,
  useSourcesServiceModifySource,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import {
  Dialog,
  FormField,
  FormProvider,
  TextArea,
  useForm,
} from '@letta-cloud/ui-component-library';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentAgent } from '../../../../hooks';

const updateSourceInstructionsSchema = z.object({
  instructions: z.string(),
});

type UpdateSourceInstructionsFormValues = z.infer<
  typeof updateSourceInstructionsSchema
>;

export interface UpdateSourceInstructionsModalProps {
  source: Source;
  trigger: React.ReactNode;
}

export function UpdateSourceInstructionsModal(
  props: UpdateSourceInstructionsModalProps,
) {
  const { source, trigger } = props;
  const t = useTranslations(
    'ADE/EditDataSourcesPanel.UpdateSourceInstructionsModal',
  );
  const queryClient = useQueryClient();
  const { id: agentId } = useCurrentAgent();
  const [isOpen, setIsOpen] = React.useState(false);

  const form = useForm<UpdateSourceInstructionsFormValues>({
    resolver: zodResolver(updateSourceInstructionsSchema),
    defaultValues: {
      instructions: source.instructions || '',
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
                  instructions: response.instructions,
                };
              }

              return currentSource;
            }),
          };
        },
      );

      setIsOpen(false);
    },
  });

  const onSubmit = useCallback(
    (values: UpdateSourceInstructionsFormValues) => {
      mutate({
        sourceId: source.id || '',
        requestBody: {
          instructions: values.instructions.trim(),
        },
      });
    },
    [mutate, source.id],
  );

  const handleOpenChange = useCallback(
    (state: boolean) => {
      setIsOpen(state);
      if (!state) {
        form.reset({ instructions: source.instructions || '' });
      }
    },
    [form, source.instructions],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={isError ? t('error') : undefined}
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        onSubmit={form.handleSubmit(onSubmit)}
        title={t('title')}
        confirmText={t('confirm')}
        isConfirmBusy={isPending}
        testId="update-source-instructions-modal"
        trigger={trigger}
      >
        <FormField
          render={({ field }) => (
            <TextArea
              autosize
              minRows={3}
              fullWidth
              {...field}
              description={t('instructions.details')}
              hideLabel
              label={t('instructions.label')}
              placeholder={t('instructions.placeholder')}
              data-testid="source-instructions-textarea"
            />
          )}
          name="instructions"
        />
      </Dialog>
    </FormProvider>
  );
}
