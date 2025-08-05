'use client';

import { Dialog, Typography } from '@letta-cloud/ui-component-library';
import type { contracts } from '@letta-cloud/sdk-web';
import { type AbTestType, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useUserHasPermission } from '$web/client/hooks/useUserHasPermission/useUserHasPermission';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';

interface ConfirmDeleteABTestDialogProps {
  trigger: React.ReactNode;
  abTest: AbTestType;
  onSuccess?: () => void;
}

export function ConfirmDeleteABTestDialog(
  props: ConfirmDeleteABTestDialogProps,
) {
  const { trigger, abTest, onSuccess } = props;
  const [open, setOpen] = useState(false);
  const { name: testName, id: abTestId } = abTest;
  const { id: projectId } = useCurrentProject();

  const queryClient = useQueryClient();

  const { mutate, isPending, error } = webApi.abTest.deleteAbTest.useMutation({
    onSuccess: () => {
      // Remove the AB test from the query cache
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
              abTests: oldData.body.abTests.filter(
                (test) => test.id !== abTestId,
              ),
            },
          };
        },
      );

      // remove the query for the specific AB test
      queryClient.removeQueries({
        queryKey: webApiQueryKeys.abTest.getAbTest(abTestId),
      });

      setOpen(false);
      if (onSuccess) {
        onSuccess();
      }
    },
  });

  const handleDelete = useCallback(() => {
    if (!abTestId) {
      return;
    }

    mutate({
      params: {
        abTestId,
      },
    });
  }, [mutate, abTestId]);

  const [canDeleteABTest] = useUserHasPermission(
    ApplicationServices.DELETE_AB_TESTS,
  );

  if (!canDeleteABTest) {
    return null;
  }

  return (
    <Dialog
      testId="confirm-delete-ab-test-dialog"
      isOpen={open}
      onOpenChange={setOpen}
      title="Delete A/B Test"
      trigger={trigger}
      errorMessage={
        error
          ? 'There was an error deleting the A/B test, please try again or contact support.'
          : undefined
      }
      isConfirmBusy={isPending}
      confirmText="Delete"
      onConfirm={handleDelete}
    >
      <Typography variant="body2">
        Please confirm you want to delete <strong>{testName}</strong>
      </Typography>
    </Dialog>
  );
}
