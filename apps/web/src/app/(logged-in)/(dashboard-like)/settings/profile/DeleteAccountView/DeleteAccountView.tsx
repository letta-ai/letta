import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import { z } from 'zod';
import {
  Alert,
  Checkbox,
  Dialog,
  FormField,
  FormProvider,
  Section,
  Typography,
  useForm,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi } from '@letta-cloud/sdk-web';

function DeleteAccountDialog() {
  const t = useTranslations('settings/account/page');
  const deleteAccountSchema = useMemo(
    () =>
      z.object({
        confirm: z.boolean().refine((value) => value === true, {
          message: t('DeleteAccountDialog.confirmCheckbox.error'),
        }),
      }),
    [t],
  );

  type DeleteAccountFormValues = z.infer<typeof deleteAccountSchema>;

  const form = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      confirm: false,
    },
  });

  const { mutate, isPending, isError } =
    webApi.user.deleteCurrentUser.useMutation({
      onSuccess: () => {
        window.location.href = 'https://www.letta.com/';
      },
    });

  const handleSubmit = useCallback(
    (values: DeleteAccountFormValues) => {
      if (isPending) {
        return;
      }

      if (!values.confirm) {
        return;
      }

      mutate({});
    },
    [isPending, mutate],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        title={t('DeleteAccountDialog.title')}
        errorMessage={isError ? t('DeleteAccountDialog.error') : undefined}
        confirmText={t('DeleteAccountDialog.confirm')}
        onSubmit={form.handleSubmit(handleSubmit)}
        trigger={
          <Typography overrideEl="span">
            <a className="underline">{t('DeleteAccountDialog.trigger')}</a>
          </Typography>
        }
      >
        <Alert
          variant="destructive"
          title={t('DeleteAccountDialog.description')}
        />
        <FormField
          name="confirm"
          render={({ field }) => (
            <Checkbox
              label={t('DeleteAccountDialog.confirmCheckbox.label')}
              onCheckedChange={field.onChange}
              checked={field.value}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

export function DeleteAccountView() {
  const t = useTranslations('settings/account/page');

  return (
    <Section title={t('DeleteAccountSection.title')}>
      <Typography>
        {t.rich('DeleteAccountSection.description', {
          action: () => <DeleteAccountDialog />,
        })}
      </Typography>
    </Section>
  );
}
