'use client';
import type { ReactNode } from 'react';
import { StartOnboardingDialog } from './StartOnboardingDialog/StartOnboardingDialog';

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider(props: OnboardingProviderProps) {
  const { children } = props;

  return (
    <>
      <StartOnboardingDialog />
      {children}
    </>
  );
}
