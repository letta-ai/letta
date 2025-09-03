'use client'
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
import { isAPIError } from '@letta-cloud/sdk-core';
import React, { useCallback, useEffect } from 'react';
import { useCurrentBasePathname } from '../../hooks';
import { useCurrentAgentMetaData } from '../../hooks';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { cloudAPI } from '@letta-cloud/sdk-cloud-api';
import { useADEAppContext } from '../../AppContext/AppContext';

interface UpdateTemplateNameDialogProps {
  trigger: React.ReactNode;
}

export function UpdateTemplateNameDialog(props: UpdateTemplateNameDialogProps) {
  const { trigger } = props;
  const [open, setOpen] = React.useState(false);
  const { templateName } = useCurrentAgentMetaData();
  const basePathname = useCurrentBasePathname();
  const { projectSlug } = useADEAppContext();

  const t = useTranslations('UpdateTemplateNameDialog');

  const updateNameFormSchema = z.object({
    name: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message: t('validation.alphanumeric'),
      })
      .min(3, { message: t('validation.minLength') })
      .max(50, { message: t('validation.maxLength') }),
  });

  type UpdateTemplateNameFormValues = z.infer<typeof updateNameFormSchema>;

  const form = useForm({
    resolver: zodResolver(updateNameFormSchema),
    defaultValues: {
      name: templateName || '',
    },
  });

  const {
    mutate: cloudTemplateMutate,
    isPending: cloudTemplatePending,
    error: cloudTemplateError,
    isSuccess: cloudSuccess,
  } = cloudAPI.templates.renameTemplate.useMutation();

  const handleSubmit = useCallback(
    (values: UpdateTemplateNameFormValues) => {
      cloudTemplateMutate(
        {
          params: {
            project: projectSlug,
            template_name: templateName || '',
          },
          body: {
            new_name: values.name,
          },
        },
        {
          onSuccess: async () => {
            window.location.href = `${basePathname}/${values.name}`;
          },
        },
      );
    },
    [
      cloudTemplateMutate,
      templateName,
      projectSlug,
      basePathname,
    ],
  );

  useEffect(() => {
    if (cloudTemplateError) {
      if (isAPIError(cloudTemplateError) && cloudTemplateError.status === 409) {
        form.setError('name', {
          message: t('error.conflict'),
        });

        return;
      }

      form.setError('name', {
        message: t('error.default'),
      });
    }
  }, [t, cloudTemplateError, form]);

  const [canUpdateTemplate] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  if (!canUpdateTemplate) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Dialog
        testId="update-template-name-dialog"
        isOpen={open}
        onOpenChange={setOpen}
        title={t('title')}
        trigger={trigger}
        errorMessage={
          cloudTemplateError ? t('error.default') : undefined
        }
        isConfirmBusy={
          cloudSuccess ||
          cloudTemplatePending
        }
        confirmText={t('confirm')}
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              data-testid="update-template-name-dialog-update-name"
              description={t('name.description')}
              label={t('name.label')}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}
