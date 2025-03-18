import { type contracts, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ServerInferResponses } from '@ts-rest/core';
import { useTranslations } from '@letta-cloud/translations';
import { toast } from '@letta-cloud/ui-component-library';

export function usePauseOnboarding() {
  const t = useTranslations('components/PauseOnboardingSlot');

  const { mutate } = webApi.user.pauseUserOnboarding.useMutation({
    onError: () => {
      toast.error(t('error'));
    },
  });

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
