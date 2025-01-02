'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Alert,
  Button,
  Checkbox,
  DashboardPageLayout,
  DashboardPageSection,
  Dialog,
  FormActions,
  FormField,
  FormProvider,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import React, { useCallback, useMemo } from 'react';
import { z } from 'zod';
import { webApi } from '$web/client';
import { zodResolver } from '@hookform/resolvers/zod';

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
          <Button
            label={t('DeleteAccountDialog.trigger')}
            color="destructive"
          />
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

function DeleteAccountSection() {
  const t = useTranslations('settings/account/page');

  return (
    <VStack border padding width="contained">
      <VStack gap="form">
        <Typography variant="heading3">
          {t('DeleteAccountSection.title')}
        </Typography>
        <Typography>{t('DeleteAccountSection.description')}</Typography>
        <FormActions align="start">
          <DeleteAccountDialog />
        </FormActions>
      </VStack>
    </VStack>
  );
}

function AccountSettingsPage() {
  const t = useTranslations('settings/account/page');

  return (
    <DashboardPageLayout title={t('title')}>
      <DashboardPageSection>
        <DeleteAccountSection />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default AccountSettingsPage;
