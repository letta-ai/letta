'use client';

/**
 * DeleteTemplateDialog - A dialog component for deleting templates
 *
 * @example
 * ```tsx
 * import { DeleteTemplateDialog } from '@letta-cloud/ui-ade-components';
 * import { Button } from '@letta-cloud/ui-component-library';
 *
 * function TemplateActions({ templateName }) {
 *   return (
 *     <DeleteTemplateDialog
 *       templateName={templateName}
 *       onSuccess={() => {
 *         // Optional: custom success handling
 *         console.log('Template deleted successfully');
 *       }}
 *       trigger={
 *         <Button color="destructive">
 *           Delete Template
 *         </Button>
 *       }
 *     />
 *   );
 * }
 * ```
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  Typography,
  useForm,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { cloudAPI } from '@letta-cloud/sdk-cloud-api';

interface DeleteTemplateDialogProps {
  onSuccess?: VoidFunction;
  trigger: React.ReactNode;
  templateName: string;
  projectSlug: string;
}

export function DeleteTemplateDialog(props: DeleteTemplateDialogProps) {
  const { onSuccess, trigger, projectSlug, templateName } = props;
  const [isOpen, setIsOpen] = useState(false);

  const t = useTranslations('DeleteTemplateDialog');

  const DeleteTemplateDialogFormSchema = useMemo(
    () =>
      z.object({
        templateName: z.literal(templateName, {
          message: t('nameError'),
        }),
      }),
    [templateName, t],
  );

  const form = useForm<z.infer<typeof DeleteTemplateDialogFormSchema>>({
    resolver: zodResolver(DeleteTemplateDialogFormSchema),
    defaultValues: {
      templateName: '',
    },
  });

  const { mutate, isPending, isSuccess, isError } =
    cloudAPI.templates.deleteTemplate.useMutation({
      onSuccess: () => {
        if (onSuccess) {
          onSuccess();
        } else {
          // Default behavior: redirect to templates list
          window.location.href = `/projects/${projectSlug}/templates`;
        }
      },
    });

  const handleSubmit = useCallback(() => {
    mutate({
      params: {
        project_id: projectSlug,
        template_name: templateName,
      },
      body: undefined,
    });
  }, [mutate, projectSlug, templateName]);

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        trigger={trigger}
        errorMessage={
          isError
            ? t('error', {
              templateName,
              })
            : undefined
        }
        confirmColor="destructive"
        confirmText={t('confirm')}
        title={t('title')}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending || isSuccess}
      >
        <Typography>{t('description')}</Typography>
        <Typography>
          {t.rich('confirmText', {
            templateName,
            strong: (chunks) => (
              <Typography overrideEl="span" bold>
                {chunks}
              </Typography>
            ),
          })}
        </Typography>
        <FormField
          name="templateName"
          render={({ field }) => (
            <Input
              fullWidth
              placeholder={templateName}
              label={t('confirmTextLabel')}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}
