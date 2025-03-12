'use client';
import type { ReactNode } from 'react';
import { useCurrentUser } from '$web/client/hooks';
import { StartOnboardingDialog } from './StartOnboardingDialog/StartOnboardingDialog';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider(props: OnboardingProviderProps) {
  const { children } = props;

  const flags = useFeatureFlag('ONBOARDING');
  const user = useCurrentUser();

  if (!user) {
    return children;
  }

  if (!user.activeOrganizationId) {
    return children;
  }

  if (!user.hasCloudAccess) {
    return children;
  }

  if (flags.isLoading || !flags.data) {
    return children;
  }

  // if no onboarding step, this means the user hasn't started onboarding
  if (!user.onboardingStatus?.currentStep) {
    // show the starting dialog
    return (
      <>
        <StartOnboardingDialog />
        {children}
      </>
    );
  }

  return <>{children}</>;
}
