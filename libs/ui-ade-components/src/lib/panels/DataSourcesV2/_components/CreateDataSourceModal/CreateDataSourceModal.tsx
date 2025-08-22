import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import {
  type AgentState,
  isAPIError,
  type SourcesServiceListSourcesDefaultResponse,
  useAgentsServiceAttachSourceToAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
  useSourcesServiceCreateSource,
  UseSourcesServiceListSourcesKeyFn,
} from '@letta-cloud/sdk-core';
import {
  BillingLink,
  Dialog,
  FormField,
  FormProvider,
  Input,
  TextArea,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentAgent } from '../../../../hooks';
import { useADEState } from '../../../../hooks/useADEState/useADEState';

interface CreateDataSourceModalProps {
  trigger: React.ReactNode;
  onClose?: () => void;
}

const CreateDataSourceSchema = z.object({
  name: z.string().min(1),
  instructions: z.string().optional(),
});

type CreateDataSourceFormValues = z.infer<typeof CreateDataSourceSchema>;

export function CreateDataSourceModal(props: CreateDataSourceModalProps) {
  const { trigger, onClose } = props;
  const [open, setOpen] = React.useState(false);
  const t = useTranslations('ADE/EditDataSourcesPanel');
  const queryClient = useQueryClient();
  const { id: agentId, embedding_config } = useCurrentAgent();

  const form = useForm<CreateDataSourceFormValues>({
    resolver: zodResolver(CreateDataSourceSchema),
    defaultValues: {
      name: 'my-new-folder',
      instructions: '',
    },
  });

  const { mutate: attachDataSource, isPending: isAttachingDataSource } =
    useAgentsServiceAttachSourceToAgent();

  const {
    mutate: createDataSource,
    isPending: isCreatingDataSource,
    error,
    reset,
  } = useSourcesServiceCreateSource();

  const isPending = useMemo(() => {
    return isCreatingDataSource || isAttachingDataSource;
  }, [isCreatingDataSource, isAttachingDataSource]);

  const handleOpenChange = useCallback(
    (nextState: boolean) => {
      setOpen(nextState);
      if (!nextState) {
        form.reset();
        reset();
      }
    },
    [form, reset],
  );

  const { isLocal } = useADEState();

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error)) {
        if (error.status === 409) {
          return t('CreateDataSourceDialog.errors.duplicateName');
        }

        if (error.status === 402) {
          return t.rich('CreateDataSourceDialog.errors.overage', {
            link: (chunks) => <BillingLink>{chunks}</BillingLink>,
          });
        }
      }

      return t('CreateDataSourceDialog.errors.default');
    }

    return undefined;
  }, [error, t]);

  const handleCreateDataSource = useCallback(
    (values: CreateDataSourceFormValues) => {
      if (isPending) {
        return;
      }

      const { name, instructions } = values;

      createDataSource(
        {
          requestBody: {
            name,
            instructions,
            embedding_config: isLocal ? embedding_config : undefined,
          },
        },
        {
          onSuccess: (response) => {
            attachDataSource(
              {
                agentId: agentId,
                sourceId: response.id || '',
              },
              {
                onSuccess: () => {
                  queryClient.setQueriesData<
                    SourcesServiceListSourcesDefaultResponse | undefined
                  >(
                    {
                      queryKey: UseSourcesServiceListSourcesKeyFn(),
                    },
                    (oldData) => {
                      if (!oldData) {
                        return [response];
                      }

                      return [
                        response,
                        ...oldData.filter(
                          (currentSource) => currentSource.id !== response.id,
                        ),
                      ];
                    },
                  );

                  queryClient.setQueriesData<AgentState | undefined>(
                    {
                      queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                        agentId: agentId,
                      }),
                    },
                    (oldData) => {
                      if (!oldData) {
                        return oldData;
                      }

                      return {
                        ...oldData,
                        sources: [
                          response,
                          ...oldData.sources.filter(
                            (currentSource) => currentSource.id !== response.id,
                          ),
                        ],
                      };
                    },
                  );

                  handleOpenChange(false);
                  onClose?.();
                },
              },
            );
          },
        },
      );
    },
    [
      embedding_config,
      isLocal,
      attachDataSource,
      createDataSource,
      agentId,
      isPending,
      handleOpenChange,
      onClose,
      queryClient,
    ],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        headerVariant="emphasis"
        onSubmit={form.handleSubmit(handleCreateDataSource)}
        title={t('CreateDataSourceDialog.titlev2')}
        errorMessage={errorMessage}
        isConfirmBusy={isPending}
        confirmText={t('CreateDataSourceDialog.create')}
        cancelText={t('CreateDataSourceDialog.cancel')}
        testId="create-data-source-modal"
        onOpenChange={handleOpenChange}
        trigger={trigger}
        isOpen={open}
      >
        <VStack gap="form">
          <FormField
            render={({ field }) => (
              <Input
                fullWidth
                {...field}
                description={t('CreateDataSourceDialog.name.description')}
                data-testid="create-data-source-dialog-name"
                label={t('CreateDataSourceDialog.name.label')}
                placeholder={t('CreateDataSourceDialog.name.placeholder')}
              />
            )}
            name="name"
          />

          <FormField
            render={({ field }) => (
              <TextArea
                autosize
                minRows={3}
                fullWidth
                {...field}
                description={t('CreateDataSourceDialog.instructions.details')}
                label={t('CreateDataSourceDialog.instructions.label')}
                placeholder={t(
                  'CreateDataSourceDialog.instructions.placeholder',
                )}
              />
            )}
            name="instructions"
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}
