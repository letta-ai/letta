'use client';
import type { ReactNode } from 'react';
import { StartOnboardingDialog } from './StartOnboardingDialog/StartOnboardingDialog';
import { useShowOnboarding } from '$web/client/hooks/useShowOnboarding/useShowOnboarding';

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider(props: OnboardingProviderProps) {
  const { children } = props;

  const showOnboardingFromInit = useShowOnboarding('init');
  const showOnboardingFromRestart = useShowOnboarding('restarted');

  if (showOnboardingFromInit || showOnboardingFromRestart) {
    return (
      <>
        <StartOnboardingDialog />
        {children}
      </>
    );
  }

  return <>{children}</>;
}
