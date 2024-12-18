'use client';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  Form,
  FormActions,
  FormField,
  FormProvider,
  Input,
  LoadingEmptyStatusComponent,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { webApi, webApiQueryKeys } from '$letta/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import type { GetCurrentOrganizationSuccessResponse } from '$letta/web-api/organizations/organizationsContracts';
import { useCurrentOrganization } from '$letta/client/hooks';

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
          }
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
    [mutate]
  );

  return (
    <DashboardPageSection>
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleSubmit)} variant="contained">
          <VStack gap="form" borderBottom paddingBottom>
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
                color="tertiary"
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

function DeleteOrganizationSettings() {
  const t = useTranslations('organization/settings');

  return (
    <DashboardPageSection>
      <VStack width="contained" gap="large">
        <Typography variant="heading5" bold>
          {t('DeleteOrganizationSettings.title')}
        </Typography>
        <Typography variant="body">
          {t('DeleteOrganizationSettings.description')}
        </Typography>
      </VStack>
    </DashboardPageSection>
  );
}

function OrganizationSettingsPage() {
  const t = useTranslations('organization/settings');
  const organization = useCurrentOrganization();

  return (
    <DashboardPageLayout title={t('title')}>
      {!organization ? (
        <LoadingEmptyStatusComponent emptyMessage="" isLoading />
      ) : (
        <>
          <EditOrganizationSettings name={organization.name} />
          <DeleteOrganizationSettings />
        </>
      )}
    </DashboardPageLayout>
  );
}

export default OrganizationSettingsPage;
