'use client';
import React, { useState, useCallback } from 'react';
import {
  Button,
  Dialog,
  FormField,
  FormProvider,
  Input,
  PlusIcon,
  VStack,
  useForm,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { BillingLink } from '@letta-cloud/ui-component-library';
import {
  webApi,
  webApiContracts,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';

const createProjectFormSchema = z.object({
  name: z.string(),
});

export function CreateProjectDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('projects/page');
  const { push } = useRouter();
  const form = useForm<z.infer<typeof createProjectFormSchema>>({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: {
      name: '',
    },
  });
  const queryClient = useQueryClient();

  const { mutate, isPending, error, isSuccess } =
    webApi.projects.createProject.useMutation({
      onSuccess: async (res) => {
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getProjects,
        });

        push(`/projects/${res.body.slug}`);
      },
    });

  const errorTranslation = useErrorTranslationMessage(error, {
    messageMap: {
      projectLimitReached: t.rich(
        'createProjectDialog.errors.projectLimitReached',
        {
          link: (chunks) => <BillingLink>{chunks}</BillingLink>,
        },
      ),
      noPermission: t('createProjectDialog.errors.noPermission'),
      default: t('createProjectDialog.errors.default'),
    },
    contract: webApiContracts.projects.createProject,
  });

  const handleSubmit = useCallback(
    (values: z.infer<typeof createProjectFormSchema>) => {
      mutate({
        body: {
          name: values.name,
        },
      });
    },
    [mutate],
  );

  const [canCRDProjects] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_PROJECTS,
  );

  if (!canCRDProjects) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={errorTranslation?.message}
        title={t('createProjectDialog.title')}
        confirmText={t('createProjectDialog.createButton')}
        isOpen={isOpen}
        testId="create-project-dialog"
        onOpenChange={setIsOpen}
        isConfirmBusy={isPending || isSuccess}
        onSubmit={form.handleSubmit(handleSubmit)}
        trigger={
          <Button
            data-testid="create-project-button"
            preIcon={<PlusIcon />}
            color="primary"
            label={t('createProjectDialog.triggerButton')}
          />
        }
      >
        <VStack gap="form">
          <FormField
            render={({ field }) => (
              <Input
                data-testid="project-name-input"
                fullWidth
                {...field}
                label={t('createProjectDialog.nameInput.label')}
              />
            )}
            name="name"
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}
