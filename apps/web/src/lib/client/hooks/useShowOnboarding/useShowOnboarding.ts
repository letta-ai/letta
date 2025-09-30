import type { OnboardingStepsType } from '@letta-cloud/types';
import { useCurrentUser } from '$web/client/hooks';

import {
  type PublicUserSchemaType,
} from '@letta-cloud/sdk-web';
import { useViewportSize } from '@mantine/hooks';
import { useEffect, useState } from 'react';

export function useShouldUserSeeOnboarding(
  user?: PublicUserSchemaType,
  step?: OnboardingStepsType | 'init',
) {
  const { width } = useViewportSize();
  const [computedWidth, setComputedWidth] = useState<number | null>(null);

  useEffect(() => {
    if (width && !computedWidth) {
      setComputedWidth(width);
    }
  }, [width, computedWidth]);

  if (!user) {
    return false;
  }

  if (!user.activeOrganizationId) {
    return false;
  }

  if (!computedWidth || computedWidth < 768) {
    return false;
  }

  if (!user.onboardingStatus) {
    return false;
  }

  if (user.onboardingStatus.pausedAt) {
    return false;
  }

  if (user.onboardingStatus.currentStep === step) {
    return true;
  }

  if (step === 'init' && !user.onboardingStatus?.currentStep) {
    return true;
  }

  return false;
}


export function useShowOnboarding(step: OnboardingStepsType | 'init') {
  const user = useCurrentUser();
  return useShouldUserSeeOnboarding(user, step);
}
