'use client';
import React, { useCallback } from 'react';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  Form,
  FormField,
  FormProvider,
  HR,
  Input,
  LoadingEmptyStatusComponent,
  RawInput,
  Section,
  useForm,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {  useCurrentUser } from '$web/client/hooks';
import { webApi, webApiQueryKeys } from '$web/client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import type {
  PublicUserSchemaType,
} from '$web/web-api/contracts';
import { OnboardingSupportUI } from './OnboardingSupportUI/OnboardingSupportUI';
import { DeleteAccountView } from './DeleteAccountView/DeleteAccountView';
import { CurrentPlan } from './CurrentPlan/CurrentPlan';


const UpdateUserProfileSchema = z.object({
  name: z.string(),
});

interface UpdateUserProfileFormProps {
  user: PublicUserSchemaType;
}

function UpdateUserProfileForm(props: UpdateUserProfileFormProps) {
  const { name, email } = props.user;

  const queryClient = useQueryClient();
  const t = useTranslations('settings/profile/page');

  const { mutate, isPending } = webApi.user.updateCurrentUser.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.user.getCurrentUser,
      });
    },
  });

  const form = useForm<z.infer<typeof UpdateUserProfileSchema>>({
    resolver: zodResolver(UpdateUserProfileSchema),
    defaultValues: {
      name,
    },
  });

  const handleSubmit = useCallback(
    (data: z.infer<typeof UpdateUserProfileSchema>) => {
      mutate({
        body: {
          name: data.name,
        },
      });
    },
    [mutate],
  );

  return (
    <Section title={t('UpdateUserProfileForm.title')}>
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleSubmit)} variant="dashboard">
          <FormField
            name="name"
            render={({ field }) => (
              <Input fullWidth label={t('form.nameInput.label')} {...field} />
            )}
          />
          <RawInput
            label={t('form.emailInput.label')}
            fullWidth
            value={email}
            disabled
          />
          <div>
            <Button
              color="secondary"
              type="submit"
              label={t('form.submitButton')}
              busy={isPending}
            ></Button>
          </div>
        </Form>
      </FormProvider>
    </Section>
  );
}

function ProfileSettingsPage() {
  const t = useTranslations('settings/profile/page');
  const user = useCurrentUser();

  return (
    <DashboardPageLayout title={t('title')}>
      <DashboardPageSection width="capped">
        {!user ? (
          <LoadingEmptyStatusComponent emptyMessage="" isLoading />
        ) : (
          <UpdateUserProfileForm user={user} />
        )}
        <HR />
        <CurrentPlan />
        <OnboardingSupportUI />
        <HR />
        <DeleteAccountView />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default ProfileSettingsPage;
