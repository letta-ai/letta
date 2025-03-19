'use client';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { useADEAppContext } from '../../AppContext/AppContext';
import { useShouldUserSeeOnboarding } from '@letta-cloud/utils-client';
import { adeTourStepAtom } from './adeTourStepAtom';

export function useADETour() {
  const [step, setStep] = useAtom(adeTourStepAtom);
  const user = useADEAppContext();
  const showOnboarding = useShouldUserSeeOnboarding(user.user, 'explore_ade');

  useEffect(() => {
    if (!showOnboarding) {
      setStep(null);
    }

    if (showOnboarding && !step) {
      setStep('welcome');
    }
  }, [showOnboarding, step, setStep]);

  return {
    currentStep: showOnboarding ? step : null,
    setStep,
  };
}
