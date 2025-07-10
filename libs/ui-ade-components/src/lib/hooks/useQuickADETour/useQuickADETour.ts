'use client';
import { useCallback, useMemo } from 'react';
import { useADEAppContext } from '../../AppContext/AppContext';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useLocalStorage } from '@mantine/hooks';
import { QUICK_ADE_TOUR_STEP } from '@letta-cloud/ui-component-library';

type Steps = 'done' | 'memory' | 'message' | 'tools' | 'welcome';

interface Config {
  step: Steps;
  agentId: string;
}

function useQuickADETourStep() {
  return useLocalStorage<Config>({
    key: QUICK_ADE_TOUR_STEP,
    defaultValue: {
      step: 'welcome',
      agentId: '',
    },
  });
}

export function useStartQuickADETour() {
  const [, setTourStepData] = useQuickADETourStep();

  return (agentId: string) => {
    setTourStepData({
      step: 'welcome',
      agentId,
    });
  };
}

export function useQuickADETour() {
  const [stepDetails, setTourStepData] = useQuickADETourStep();
  const user = useADEAppContext();
  const { agentId } = useCurrentAgentMetaData();

  const currentStep = useMemo(() => {
    if (!user?.user) {
      return null;
    }

    if (stepDetails.agentId !== agentId) {
      return null;
    }

    return stepDetails.step;
  }, [agentId, stepDetails, user]);

  const resetTour = useCallback(() => {
    setTourStepData({
      step: 'welcome',
      agentId: '',
    });
  }, [setTourStepData]);

  const setStep = useCallback(
    (step: Steps) => {
      setTourStepData({
        step,
        agentId,
      });
    },
    [setTourStepData, agentId],
  );

  return {
    currentStep,
    setStep,
    resetTour,
  };
}
