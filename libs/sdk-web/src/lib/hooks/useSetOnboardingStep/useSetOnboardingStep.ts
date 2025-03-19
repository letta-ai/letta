'use client';
import { type contracts, webApi, webApiQueryKeys } from '../../../index';
import { useCallback, useEffect } from 'react';
import type { OnboardingStepsType } from '@letta-cloud/types';
import type { ServerInferResponses } from '@ts-rest/core';
import { useQueryClient } from '@tanstack/react-query';

interface SetOnboardingStepPayload {
  onboardingStep: OnboardingStepsType;
  stepToClaim?: OnboardingStepsType;
  onSuccess?: VoidFunction;
}

export function useSetOnboardingStep() {
  const { mutate, isPending, isSuccess, reset } =
    webApi.user.updateUserOnboardingStep.useMutation();

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const queryClient = useQueryClient();

  const handleUpdateStatus = useCallback(
    (onboardingStep: OnboardingStepsType) => {
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
              pausedAt: null,
              completedSteps: [
                ...(oldData.body.onboardingStatus?.completedSteps ?? []),
                onboardingStep,
              ],
              claimedSteps: oldData.body.onboardingStatus?.claimedSteps ?? [],
              currentStep: onboardingStep,
            },
          },
        };
      });
    },
    [queryClient],
  );

  const setOnboardingStep = useCallback(
    (payload: SetOnboardingStepPayload) => {
      handleUpdateStatus(payload.onboardingStep);

      mutate(
        {
          body: {
            onboardingStep: payload.onboardingStep,
            ...(payload.stepToClaim
              ? { stepToClaim: payload.stepToClaim }
              : {}),
          },
        },
        {
          onSuccess: () => {
            if (payload.onSuccess) {
              payload.onSuccess();
            }
          },
        },
      );
    },
    [mutate, handleUpdateStatus],
  );

  return { setOnboardingStep, isPending, isSuccess };
}
