import {
  type PublicUserSchemaType,
  useFeatureFlag,
} from '@letta-cloud/sdk-web';
import { useViewportSize } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import type { OnboardingStepsType } from '@letta-cloud/types';

export function useShouldUserSeeOnboarding(
  user?: PublicUserSchemaType,
  step?: OnboardingStepsType | 'init',
) {
  const flags = useFeatureFlag('ONBOARDING');
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

  if (!user.hasCloudAccess) {
    return false;
  }

  if (!computedWidth || computedWidth < 768) {
    return false;
  }

  if (flags.isLoading || !flags.data) {
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
