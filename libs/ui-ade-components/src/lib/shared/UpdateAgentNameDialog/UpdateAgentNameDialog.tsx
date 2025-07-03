import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAPIError, useAgentsServiceModifyAgent } from '@letta-cloud/sdk-core';
import React, { useCallback, useEffect } from 'react';
import { useAgentBaseTypeName } from '../../hooks';
import { useCurrentAgent } from '../../hooks';
import { useCurrentBasePathname } from '../../hooks';
import { useCurrentAgentMetaData } from '../../hooks';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { webApi } from '@letta-cloud/sdk-web';

interface UpdateNameDialogProps {
  trigger: React.ReactNode;
}

export function UpdateNameDialog(props: UpdateNameDialogProps) {
  const { trigger } = props;
  const [open, setOpen] = React.useState(false);
  const { agentName, isTemplate, isLocal } = useCurrentAgentMetaData();
  const basePathname = useCurrentBasePathname();

  const t = useTranslations('UpdateNameDialog');

  const updateNameFormSchema = isTemplate
    ? z.object({
        name: z
          .string()
          .regex(/^[a-zA-Z0-9_-]+$/, {
            message: 'Name must be alphanumeric, with underscores or dashes',
          })
          .min(3, { message: 'Name must be at least 3 characters long' })
          .max(50, { message: 'Name must be at most 50 characters long' }),
      })
    : z.object({
        name: z
          .string()
          .min(3, { message: 'Name must be at least 3 characters long' })
          .max(50, { message: 'Name must be at most 50 characters long' }),
      });

  type UpdateNameFormValues = z.infer<typeof updateNameFormSchema>;

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
  } = useAgentsServiceModifyAgent();

  const agentBaseType = useAgentBaseTypeName();

  const { id: agentTemplateId } = useCurrentAgent();

  const { mutate, isPending, error } = useAgentsServiceModifyAgent();

  const {
    mutate: templateMutate,
    isPending: templatePending,
    error: templateError,
  } = webApi.agentTemplates.updateTemplateName.useMutation();

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

      if (isTemplate) {
        templateMutate(
          {
            params: {
              agentTemplateId,
            },
            body: {
              name: values.name,
            },
          },
          {
            onSuccess: async () => {
              window.location.href = `${basePathname}/${values.name}`;
            },
          },
        );

        return;
      }

      mutate(
        {
          requestBody: {
            name: values.name,
          },
          agentId: agentTemplateId,
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
    [
      isLocal,
      isTemplate,
      mutate,
      agentTemplateId,
      localMutate,
      templateMutate,
      basePathname,
    ],
  );

  useEffect(() => {
    if (error) {
      if (isAPIError(error) && error.status === 409) {
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

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  if (!canUpdateAgent) {
    return null;
  }

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
        errorMessage={
          localError || templateError ? t('error.default') : undefined
        }
        isConfirmBusy={isPending || localIsPending || templatePending}
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
