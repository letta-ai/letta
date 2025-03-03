'use client';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  Form,
  FormActions,
  FormField,
  FormProvider,
  HR,
  Input,
  LoadingEmptyStatusComponent,
  Section,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { webApi, webApiQueryKeys } from '$web/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import type { GetCurrentOrganizationSuccessResponse } from '$web/web-api/contracts';
import { useCurrentOrganization } from '$web/client/hooks';

const EditOrganizationSettingsSchema = z.object({
  name: z.string(),
});

type EditOrganizationSettingsFormType = z.infer<
  typeof EditOrganizationSettingsSchema
>;

interface EditOrganizationSettingsProps {
  name: string;
}

function EditOrganizationSettings(props: EditOrganizationSettingsProps) {
  const t = useTranslations('organization/settings');
  const { name: defaultName } = props;
  const queryClient = useQueryClient();
  const { mutate, isError, isPending } =
    webApi.organizations.updateOrganization.useMutation({
      onSuccess: (response) => {
        queryClient.setQueriesData<
          GetCurrentOrganizationSuccessResponse | undefined
        >(
          {
            queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              body: {
                ...oldData.body,
                name: response.body.name,
              },
            };
          },
        );

        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
        });
      },
    });

  const form = useForm<EditOrganizationSettingsFormType>({
    resolver: zodResolver(EditOrganizationSettingsSchema),
    defaultValues: {
      name: defaultName,
    },
  });

  const handleSubmit = useCallback(
    (values: EditOrganizationSettingsFormType) => {
      mutate({
        body: {
          name: values.name,
        },
      });
    },
    [mutate],
  );

  return (
    <DashboardPageSection>
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleSubmit)}>
          <VStack gap="form">
            <FormField
              render={({ field }) => {
                return (
                  <Input
                    fullWidth
                    autoComplete="false"
                    label={t('EditOrganizationSettings.name.label')}
                    {...field}
                  />
                );
              }}
              name="name"
            />
            <FormActions
              align="start"
              errorMessage={
                isError ? t('EditOrganizationSettings.error') : undefined
              }
            >
              <Button
                busy={isPending}
                color="secondary"
                label="Save"
                type="submit"
              />
            </FormActions>
          </VStack>
        </Form>
      </FormProvider>
    </DashboardPageSection>
  );
}

function MembershipRules() {
  const t = useTranslations('organization/settings');

  return (
    <Section
      title={t('MembershipRules.title')}
      description={t('MembershipRules.description')}
      actions={
        <Button
          color="secondary"
          label={t('MembershipRules.actions')}
          href="/settings/organization/members/invite-rules"
        />
      }
    ></Section>
  );
}

function DeleteOrganizationSettings() {
  const t = useTranslations('organization/settings');

  return (
    <Section
      title={t('DeleteOrganizationSettings.title')}
      description={t('DeleteOrganizationSettings.description')}
    ></Section>
  );
}

function OrganizationSettingsPage() {
  const t = useTranslations('organization/settings');
  const organization = useCurrentOrganization();

  return (
    <DashboardPageLayout title={t('title')}>
      <VStack width="largeContained">
        {!organization ? (
          <LoadingEmptyStatusComponent emptyMessage="" isLoading />
        ) : (
          <>
            <EditOrganizationSettings name={organization.name} />
            <HR />
            <DashboardPageSection>
              <MembershipRules />
            </DashboardPageSection>
            <HR />
            <DashboardPageSection>
              <DeleteOrganizationSettings />
            </DashboardPageSection>
          </>
        )}
      </VStack>
    </DashboardPageLayout>
  );
}

export default OrganizationSettingsPage;
