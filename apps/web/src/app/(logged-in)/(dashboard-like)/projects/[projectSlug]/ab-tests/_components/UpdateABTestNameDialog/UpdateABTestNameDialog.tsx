'use client';

import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import type { contracts } from '@letta-cloud/sdk-web';
import { type AbTestType, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { isAPIError } from '@letta-cloud/sdk-core';
import { useUserHasPermission } from '$web/client/hooks/useUserHasPermission/useUserHasPermission';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';

interface UpdateABTestNameDialogProps {
  trigger: React.ReactNode;
  abTest: AbTestType;
}

export function UpdateABTestNameDialog(props: UpdateABTestNameDialogProps) {
  const { trigger, abTest } = props;
  const [open, setOpen] = useState(false);
  const { name: currentName, id: abTestId } = abTest;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations('projects/ab-tests.UpdateABTestNameDialog');

  const updateNameFormSchema = z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be at most 100 characters long'),
  });

  type UpdateNameFormValues = z.infer<typeof updateNameFormSchema>;

  const form = useForm({
    resolver: zodResolver(updateNameFormSchema),
    defaultValues: {
      name: currentName,
    },
  });

  const queryClient = useQueryClient();
  // Update form when currentName changes
  useEffect(() => {
    form.reset({ name: currentName });
  }, [currentName, form]);

  const { mutate, isPending, error } = webApi.abTest.updateAbTest.useMutation({
    onSuccess: (_, vars) => {
      // set the query data directly
      queryClient.setQueriesData<
        ServerInferResponses<typeof contracts.abTest.getAbTests, 200>
      >(
        {
          queryKey: webApiQueryKeys.abTest.getAbTestWithProject(projectId),
          exact: false,
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            body: {
              ...oldData.body,
              abTests: oldData.body.abTests.map((test) => {
                if (test.id === abTestId) {
                  return {
                    ...test,
                    name: vars.body?.name || test.name,
                  };
                }

                return test;
              }),
            },
          };
        },
      );

      queryClient.setQueriesData<
        ServerInferResponses<typeof contracts.abTest.getAbTest, 200>
      >(
        {
          queryKey: webApiQueryKeys.abTest.getAbTest(abTestId),
          exact: false,
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            body: {
              ...oldData.body,
              name: vars.body?.name || oldData.body.name,
            },
          };
        },
      );

      setOpen(false);
      form.reset();
    },
  });

  const handleSubmit = useCallback(
    (values: UpdateNameFormValues) => {
      if (!abTestId) {
        return;
      }

      mutate({
        params: {
          abTestId,
        },
        body: {
          name: values.name,
        },
      });
    },
    [mutate, abTestId],
  );

  useEffect(() => {
    if (error) {
      if (isAPIError(error) && error.status === 409) {
        form.setError('name', {
          message: t('error.conflict'),
        });
        return;
      }

      if (isAPIError(error) && error.status === 400) {
        form.setError('name', {
          message: t('error.validation'),
        });
        return;
      }

      form.setError('name', {
        message: t('error.default'),
      });
    }
  }, [t, error, form]);

  const [canUpdateABTest] = useUserHasPermission(
    ApplicationServices.UPDATE_AB_TESTS,
  );

  if (!canUpdateABTest) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Dialog
        testId="update-ab-test-name-dialog"
        isOpen={open}
        onOpenChange={setOpen}
        title={t('title')}
        trigger={trigger}
        errorMessage={error ? t('error.default') : undefined}
        isConfirmBusy={isPending}
        confirmText={t('confirm')}
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              data-testid="update-ab-test-name-dialog-input"
              description={t('name.description')}
              label={t('name.label')}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}
