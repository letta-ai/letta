'use client';

import { z } from 'zod';
import {
  Dialog,
  FormField,
  FormProvider,
  TextArea,
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

interface UpdateDescriptionEditorProps {
  trigger: React.ReactNode;
  abTest: AbTestType;
}

export function UpdateDescriptionEditor(props: UpdateDescriptionEditorProps) {
  const { trigger, abTest } = props;
  const [open, setOpen] = useState(false);
  const { description: currentDescription, id: abTestId } = abTest;
  const { id: projectId } = useCurrentProject();

  const updateDescriptionFormSchema = z.object({
    description: z
      .string()
      .max(5000, 'Description cannot exceed 5000 characters')
      .optional(),
  });

  type UpdateDescriptionFormValues = z.infer<
    typeof updateDescriptionFormSchema
  >;

  const form = useForm({
    resolver: zodResolver(updateDescriptionFormSchema),
    defaultValues: {
      description: currentDescription || '',
    },
  });

  const queryClient = useQueryClient();

  // Update form when currentDescription changes
  useEffect(() => {
    form.reset({ description: currentDescription || '' });
  }, [currentDescription, form]);

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
                    description: vars.body?.description || test.description,
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
              description: vars.body?.description || oldData.body.description,
            },
          };
        },
      );

      setOpen(false);
      form.reset();
    },
  });

  const handleSubmit = useCallback(
    (values: UpdateDescriptionFormValues) => {
      if (!abTestId) {
        return;
      }

      mutate({
        params: {
          abTestId,
        },
        body: {
          description: values.description?.trim() || undefined,
        },
      });
    },
    [mutate, abTestId],
  );

  useEffect(() => {
    if (error) {
      if (isAPIError(error) && error.status === 400) {
        form.setError('description', {
          message: 'Invalid description format, please check your input',
        });
        return;
      }

      form.setError('description', {
        message:
          'There was an error updating the description, please try again or contact support.',
      });
    }
  }, [error, form]);

  const [canUpdateABTest] = useUserHasPermission(
    ApplicationServices.UPDATE_AB_TESTS,
  );

  if (!canUpdateABTest) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Dialog
        testId="update-ab-test-description-dialog"
        isOpen={open}
        onOpenChange={setOpen}
        title="Update A/B Test Description"
        trigger={trigger}
        errorMessage={
          error
            ? 'There was an error updating the description, please try again or contact support.'
            : undefined
        }
        isConfirmBusy={isPending}
        confirmText="Update"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          name="description"
          render={({ field }) => (
            <TextArea
              fullWidth
              data-testid="update-ab-test-description-dialog-textarea"
              description="Update the description for this A/B test."
              label="Description"
              placeholder="Enter a description for this A/B test..."
              rows={4}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}
