import { type contracts, webApi, webApiQueryKeys } from '../../../index';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ServerInferResponses } from '@ts-rest/core';

export function usePauseOnboarding() {
  const { mutate } = webApi.user.pauseUserOnboarding.useMutation();

  const queryClient = useQueryClient();

  const pauseOnboarding = useCallback(() => {
    queryClient.setQueriesData<
      | ServerInferResponses<typeof contracts.user.getCurrentUser, 200>
      | undefined
    >({ queryKey: webApiQueryKeys.user.getCurrentUser }, (oldData) => {
      if (!oldData) {
        return oldData;
      }

      if (!oldData.body.onboardingStatus) {
        return oldData;
      }

      return {
        ...oldData,
        body: {
          ...oldData.body,
          onboardingStatus: {
            ...oldData.body.onboardingStatus,
            pausedAt: new Date().toString(),
          },
        },
      };
    });

    mutate({});
  }, [mutate, queryClient]);

  return { pauseOnboarding };
}
