import { type contracts, webApi, webApiQueryKeys } from '../../../index';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ServerInferResponses } from '@ts-rest/core';

export function useUnpauseOnboarding() {
  const { mutate } = webApi.user.unpauseUserOnboarding.useMutation();

  const queryClient = useQueryClient();

  const unpauseOnboarding = useCallback(() => {
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
            pausedAt: null,
          },
        },
      };
    });

    mutate({});
  }, [mutate, queryClient]);

  return { unpauseOnboarding };
}
