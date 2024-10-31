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
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { GetProjectByIdContractSuccessResponse } from '$letta/web-api/contracts';

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
          Delete Project
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
              confirmText="Delete Project"
              confirmColor="destructive"
              trigger={<Button label="Delete Project" color="destructive" />}
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
                    label="Project Name"
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

const EditProjectSettingsSchema = z.object({
  name: z.string(),
});

type EditProjectSettingsFormType = z.infer<typeof EditProjectSettingsSchema>;

function EditSettingsSection() {
  const { slug, id: projectId } = useCurrentProject();
  const queryClient = useQueryClient();
  const { mutate, isError, isPending } =
    webApi.projects.updateProject.useMutation({
      onSuccess: (response) => {
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
    },
  });

  const handleSubmit = useCallback(
    (values: EditProjectSettingsFormType) => {
      mutate({
        body: {
          name: values.name,
        },
        params: {
          projectId,
        },
      });
    },
    [mutate, projectId]
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
                    label="Project Name"
                    {...field}
                  />
                );
              }}
              name="name"
            />
            <FormActions
              align="start"
              errorMessage={
                isError
                  ? 'Failed to save changes, contact support if this persists'
                  : undefined
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

function SettingsPage() {
  return (
    <DashboardPageLayout title="Project Settings">
      <EditSettingsSection />
      <DeleteProjectSettings />
    </DashboardPageLayout>
  );
}

export default SettingsPage;
