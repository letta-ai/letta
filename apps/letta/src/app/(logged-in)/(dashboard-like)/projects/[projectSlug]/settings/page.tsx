'use client';
import {
  Button,
  Checkbox,
  DashboardPageLayout,
  DashboardPageSection,
  Dialog,
  Form,
  FormActions,
  FormField,
  FormProvider,
  Input,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentProject } from '../hooks';
import { webApi, webApiContracts, webApiQueryKeys } from '$letta/client';
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  GetProjectByIdContractSuccessResponse,
  UpdateProjectPayloadType,
} from '$letta/web-api/contracts';
import { useTranslations } from 'next-intl';
import { useErrorTranslationMessage } from '@letta-web/helpful-client-utils';

const DeleteProjectSchema = z.object({
  name: z.string(),
  confirmed: z.boolean(),
});

type DeleteProjectFormType = z.infer<typeof DeleteProjectSchema>;

function DeleteProjectSettings() {
  const { mutate, isError, isPending } =
    webApi.projects.deleteProject.useMutation();
  const { id: projectId } = useCurrentProject();
  const form = useForm<DeleteProjectFormType>({
    resolver: zodResolver(DeleteProjectSchema),
  });

  const handleReset = useCallback(() => {
    form.reset();
  }, [form]);

  const handleSubmit = useCallback(() => {
    mutate(
      {
        params: {
          projectId,
        },
      },
      {
        onSuccess: () => {
          window.location.href = '/projects';
        },
      }
    );
  }, [mutate, projectId]);

  return (
    <DashboardPageSection>
      <VStack width="contained" gap="large">
        <Typography variant="heading5" bold>
          Delete project
        </Typography>
        <Typography variant="body">
          Deleting a project will permanently remove all data associated with
          it. This action cannot be undone. It will delete all deployments,
          agents, and configurations associated with this project.
        </Typography>
        <FormActions align="start">
          <FormProvider {...form}>
            <Dialog
              isConfirmBusy={isPending}
              errorMessage={
                isError
                  ? 'Failed to delete project - please contact support'
                  : undefined
              }
              onSubmit={form.handleSubmit(handleSubmit)}
              onOpenChange={(isOpen) => {
                if (!isOpen) {
                  handleReset();
                }
              }}
              title="Are you sure you want to delete this project?"
              confirmText="Delete project"
              confirmColor="destructive"
              trigger={<Button label="Delete project" color="destructive" />}
            >
              <Typography>
                This action cannot be undone. All data associated with this
                project will be permanently deleted.
              </Typography>
              <FormField
                name="name"
                render={({ field }) => (
                  <Input
                    fullWidth
                    {...field}
                    label="Project name"
                    placeholder="Type the project name to confirm"
                  />
                )}
              />
              <FormField
                name="confirmed"
                render={({ field }) => {
                  return (
                    <Checkbox
                      fullWidth
                      label="I understand the consequences of deleting this project"
                      onCheckedChange={field.onChange}
                      checked={field.value}
                    />
                  );
                }}
              />
            </Dialog>
          </FormProvider>
        </FormActions>
      </VStack>
    </DashboardPageSection>
  );
}

function EditSettingsSection() {
  const { slug, id: projectId } = useCurrentProject();
  const t = useTranslations('project/[projectId]/settings');

  const EditProjectSettingsSchema = useMemo(() => {
    return z.object({
      name: z.string(),
      slug: z.string().regex(/^[a-zA-Z0-9_-]+$/, {
        message: t('EditProjectSettings.errors.slug'),
      }),
    });
  }, [t]);

  type EditProjectSettingsFormType = z.infer<typeof EditProjectSettingsSchema>;

  const queryClient = useQueryClient();
  const { mutate, error, isPending } =
    webApi.projects.updateProject.useMutation({
      onSuccess: (response) => {
        // if we have a new slug, redirect the user to the new slug
        if (response.body.slug !== slug) {
          window.location.href = `/projects/${response.body.slug}/settings`;
        }

        queryClient.setQueriesData<
          GetProjectByIdContractSuccessResponse | undefined
        >(
          {
            queryKey: webApiQueryKeys.projects.getProjectByIdOrSlug(slug),
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              status: 200,
              body: {
                updatedAt: new Date().toISOString(),
                id: oldData.body.id,
                name: response.body.name,
                slug: oldData.body.slug,
              },
            };
          }
        );

        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getProjects,
        });
      },
    });

  const { name } = useCurrentProject();
  const form = useForm<EditProjectSettingsFormType>({
    resolver: zodResolver(EditProjectSettingsSchema),
    defaultValues: {
      name,
      slug,
    },
  });

  const errorMessage = useErrorTranslationMessage(error, {
    messageMap: {
      atLeastOneFieldRequired: t(
        'EditProjectSettings.errors.atLeastOneFieldRequired'
      ),

      slugAlreadyTaken: t('EditProjectSettings.errors.slugAlreadyTaken'),
      default: t('EditProjectSettings.errors.default'),
    },
    contract: webApiContracts.projects.updateProject,
  });

  const handleSubmit = useCallback(
    (values: EditProjectSettingsFormType) => {
      // create a payload of only changed values
      const body: UpdateProjectPayloadType = {};

      if (values.name !== name) {
        body.name = values.name;
      }

      if (values.slug !== slug) {
        body.slug = values.slug;
      }

      if (Object.keys(body).length === 0) {
        return;
      }

      mutate({
        body,
        params: {
          projectId,
        },
      });
    },
    [mutate, name, projectId, slug]
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
                    label={t('EditProjectSettings.name.label')}
                    {...field}
                  />
                );
              }}
              name="name"
            />
            <FormField
              render={({ field }) => {
                return (
                  <Input
                    fullWidth
                    autoComplete="false"
                    label={t('EditProjectSettings.slug.label')}
                    placeholder={t('EditProjectSettings.slug.placeholder')}
                    {...field}
                  />
                );
              }}
              name="slug"
            />
            <FormActions align="start" errorMessage={errorMessage}>
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

function SettingsPage() {
  const t = useTranslations('project/[projectId]/settings');

  return (
    <DashboardPageLayout title={t('title')}>
      <EditSettingsSection />
      <DeleteProjectSettings />
    </DashboardPageLayout>
  );
}

export default SettingsPage;
