import { useCurrentAgentMetaData } from '../../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { useCurrentProject } from '../../../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-web/component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAgentsServiceUpdateAgent } from '@letta-web/letta-agents-api';
import { useCurrentAgent } from '../../hooks';
import { webOriginSDKApi } from '$letta/client';
import React, { useCallback, useEffect } from 'react';
import { isFetchError } from '@ts-rest/react-query/v5';
import { useAgentBaseTypeName } from '../../hooks/useAgentBaseNameType/useAgentBaseNameType';

interface UpdateNameDialogProps {
  trigger: React.ReactNode;
}

const updateNameFormSchema = z.object({
  name: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message: 'Name must be alphanumeric, with underscores or dashes',
    })
    .min(3, { message: 'Name must be at least 3 characters long' })
    .max(50, { message: 'Name must be at most 50 characters long' }),
});

type UpdateNameFormValues = z.infer<typeof updateNameFormSchema>;

export function UpdateNameDialog(props: UpdateNameDialogProps) {
  const { trigger } = props;
  const [open, setOpen] = React.useState(false);
  const { agentName, isTemplate, isLocal } = useCurrentAgentMetaData();
  const { slug: projectSlug } = useCurrentProject();

  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const form = useForm({
    resolver: zodResolver(updateNameFormSchema),
    defaultValues: {
      name: agentName,
    },
  });

  const {
    mutate: localMutate,
    isPending: localIsPending,
    error: localError,
  } = useAgentsServiceUpdateAgent();

  const agentBaseType = useAgentBaseTypeName();

  const { id: agentTemplateId } = useCurrentAgent();

  const { mutate, isPending, error } =
    webOriginSDKApi.agents.updateAgent.useMutation();

  const handleSubmit = useCallback(
    (values: UpdateNameFormValues) => {
      if (isLocal) {
        localMutate(
          {
            agentId: agentTemplateId,
            requestBody: {
              id: agentTemplateId,
              name: values.name,
            },
          },
          {
            onSuccess: () => {
              window.location.reload();
            },
          }
        );

        return;
      }

      mutate(
        {
          body: { name: values.name, id: agentTemplateId },
          params: {
            agent_id: agentTemplateId,
          },
        },
        {
          onSuccess: async () => {
            if (isTemplate) {
              window.location.href = `/projects/${projectSlug}/templates/${values.name}`;
            } else {
              window.location.href = `/projects/${projectSlug}/agents/${agentTemplateId}`;
            }
          },
        }
      );
    },
    [isLocal, localMutate, mutate, agentTemplateId, isTemplate, projectSlug]
  );

  useEffect(() => {
    if (error && !isFetchError(error)) {
      if (error.status === 409) {
        form.setError('name', {
          message: t('UpdateNameDialog.error.conflict', {
            agentBaseType: agentBaseType.base,
          }),
        });

        return;
      }

      form.setError('name', {
        message: t('UpdateNameDialog.error.default'),
      });
    }
  }, [t, error, form, agentBaseType.base]);

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        title={t('UpdateNameDialog.title', {
          agentBaseType: agentBaseType.capitalized,
        })}
        trigger={trigger}
        errorMessage={
          localError ? t('UpdateNameDialog.error.default') : undefined
        }
        isConfirmBusy={isPending || localIsPending}
        confirmText={t('UpdateNameDialog.confirm')}
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              description={t('UpdateNameDialog.name.description', {
                agentBaseType: agentBaseType.base,
              })}
              label={t('UpdateNameDialog.name.label')}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}
