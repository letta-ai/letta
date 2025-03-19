import type { OnboardingStepsType } from '@letta-cloud/types';
import { useShouldUserSeeOnboarding } from '@letta-cloud/utils-client';
import { useCurrentUser } from '$web/client/hooks';

export function useShowOnboarding(step: OnboardingStepsType | 'init') {
  const user = useCurrentUser();
  return useShouldUserSeeOnboarding(user, step);
}
