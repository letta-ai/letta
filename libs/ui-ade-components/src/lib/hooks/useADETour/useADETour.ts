'use client';
import { useAtom } from 'jotai';
import { useEffect, useMemo } from 'react';
import { useADEAppContext } from '../../AppContext/AppContext';
import { useShouldUserSeeOnboarding } from '@letta-cloud/utils-client';
import { adeTourStepAtom } from './adeTourStepAtom';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';

export function useADETour() {
  const [step, setStep] = useAtom(adeTourStepAtom);
  const user = useADEAppContext();
  const { isTemplate } = useCurrentAgentMetaData();
  const showOnboarding = useShouldUserSeeOnboarding(user.user, 'explore_ade');

  const currentStep = useMemo(() => {
    if (!showOnboarding) {
      return null;
    }

    if (isTemplate) {
      return null;
    }

    return step;
  }, [showOnboarding, step, isTemplate]);

  useEffect(() => {
    if (!showOnboarding) {
      setStep(null);
    }

    if (showOnboarding && !step) {
      setStep('welcome');
    }
  }, [showOnboarding, step, setStep]);

  return {
    currentStep,
    setStep,
  };
}
