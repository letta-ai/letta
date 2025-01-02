import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-web/component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAgentsServiceUpdateAgent } from '@letta-web/letta-agents-api';
import { webOriginSDKApi } from '@letta-web/letta-agents-api';
import React, { useCallback, useEffect } from 'react';
import { isFetchError } from '@ts-rest/react-query/v5';
import { useAgentBaseTypeName } from '../../hooks';
import { useCurrentAgent } from '../../hooks';
import { useCurrentBasePathname } from '../../hooks';
import { useCurrentAgentMetaData } from '../../hooks';

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
  const basePathname = useCurrentBasePathname();

  const t = useTranslations('UpdateNameDialog');

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
              name: values.name,
            },
          },
          {
            onSuccess: () => {
              window.location.reload();
            },
          },
        );

        return;
      }

      mutate(
        {
          body: { name: values.name },
          params: {
            agent_id: agentTemplateId,
          },
        },
        {
          onSuccess: async () => {
            if (isTemplate) {
              window.location.href = `${basePathname}/${values.name}`;
            } else {
              window.location.href = `${basePathname}/${agentTemplateId}`;
            }
          },
        },
      );
    },
    [isLocal, localMutate, mutate, agentTemplateId, isTemplate, basePathname],
  );

  useEffect(() => {
    if (error && !isFetchError(error)) {
      if (error.status === 409) {
        form.setError('name', {
          message: t('error.conflict', {
            agentBaseType: agentBaseType.base,
          }),
        });

        return;
      }

      form.setError('name', {
        message: t('error.default'),
      });
    }
  }, [t, error, form, agentBaseType.base]);

  return (
    <FormProvider {...form}>
      <Dialog
        testId="update-name-dialog"
        isOpen={open}
        onOpenChange={setOpen}
        title={t('title', {
          agentBaseType: agentBaseType.capitalized,
        })}
        trigger={trigger}
        errorMessage={localError ? t('error.default') : undefined}
        isConfirmBusy={isPending || localIsPending}
        confirmText={t('confirm')}
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              data-testid="update-name-dialog-update-name"
              description={t('name.description', {
                agentBaseType: agentBaseType.base,
              })}
              label={t('name.label')}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}
