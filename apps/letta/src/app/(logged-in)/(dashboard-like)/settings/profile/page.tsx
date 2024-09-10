'use client';
import React, { useCallback } from 'react';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  Form,
  FormField,
  FormProvider,
  Input,
  RawInput,
  useForm,
} from '@letta-web/component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentUser } from '$letta/client/hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useQueryClient } from '@tanstack/react-query';

const UpdateUserProfileSchema = z.object({
  name: z.string(),
});

function UpdateUserProfileForm() {
  const { name, email } = useCurrentUser();
  const queryClient = useQueryClient();

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
    [mutate]
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)} variant="contained">
        <FormField
          name="name"
          render={({ field }) => (
            <Input fullWidth label="Your name" {...field} />
          )}
        />
        <RawInput label="Email" fullWidth value={email} disabled />
        <div>
          <Button
            color="secondary"
            type="submit"
            label="Update profile"
            busy={isPending}
          ></Button>
        </div>
      </Form>
    </FormProvider>
  );
}

function ProfileSettingsPage() {
  return (
    <DashboardPageLayout title="Profile settings">
      <DashboardPageSection>
        <UpdateUserProfileForm />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default ProfileSettingsPage;
