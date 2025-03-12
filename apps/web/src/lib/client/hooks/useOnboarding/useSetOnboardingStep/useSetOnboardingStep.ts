import { type contracts, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCallback, useEffect } from 'react';
import type { OnboardingStepsType } from '@letta-cloud/types';
import type { ServerInferResponses } from '@ts-rest/core';
import { useQueryClient } from '@tanstack/react-query';

export function useSetOnboardingStep() {
  const { mutate, isPending, isSuccess, reset } =
    webApi.user.updateUserOnboardingStep.useMutation();

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const queryClient = useQueryClient();

  const setOnboardingStep = useCallback(
    (onboardingStep: OnboardingStepsType, onSuccess?: VoidFunction) => {
      mutate(
        {
          body: {
            onboardingStep,
          },
        },
        {
          onSuccess: () => {
            queryClient.setQueriesData<
              | ServerInferResponses<typeof contracts.user.getCurrentUser, 200>
              | undefined
            >({ queryKey: webApiQueryKeys.user.getCurrentUser }, (oldData) => {
              if (!oldData) {
                return oldData;
              }

              return {
                ...oldData,
                body: {
                  ...oldData.body,
                  onboardingStatus: {
                    completedSteps: [
                      ...(oldData.body.onboardingStatus?.completedSteps ?? []),
                      onboardingStep,
                    ],
                    claimedSteps:
                      oldData.body.onboardingStatus?.claimedSteps ?? [],
                    currentStep: onboardingStep,
                  },
                },
              };
            });

            if (onSuccess) {
              onSuccess();
            }
          },
        },
      );
    },
    [mutate, queryClient],
  );

  return { setOnboardingStep, isPending, isSuccess };
}
