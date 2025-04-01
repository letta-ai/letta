'use client';
import { useMemo } from 'react';
import { useADEAppContext } from '../../AppContext/AppContext';
import { useShouldUserSeeOnboarding } from '@letta-cloud/utils-client';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useLocalStorage } from '@mantine/hooks';

type Steps = 'core_memories' | 'chat' | 'tools' | 'template' | 'welcome';

export function useADETourStep() {
  return useLocalStorage<Steps>({
    key: 'ade_tour_step',
    defaultValue: 'welcome',
  });
}

export function useADETour() {
  const [step, setStep] = useADETourStep();
  const user = useADEAppContext();
  const { isTemplate } = useCurrentAgentMetaData();
  const showOnboarding = useShouldUserSeeOnboarding(user.user, 'explore_ade');

  const currentStep = useMemo(() => {
    if (!showOnboarding) {
      return null;
    }

    if (!isTemplate) {
      return null;
    }

    return step;
  }, [showOnboarding, step, isTemplate]);

  return {
    currentStep,
    setStep,
  };
}
