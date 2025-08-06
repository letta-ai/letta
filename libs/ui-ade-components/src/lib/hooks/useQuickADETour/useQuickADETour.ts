'use client';
import { useCallback, useMemo } from 'react';
import { useADEAppContext } from '../../AppContext/AppContext';
import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useLocalStorage } from '@mantine/hooks';
export const QUICK_ADE_TOUR_STEP = 'quick_ade_tour_step';

type Steps = 'done' | 'memory' | 'message' | 'simulator' | 'tools' | 'welcome';

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

export function useResetQuickADETour() {
  const [, setTourStepData] = useQuickADETourStep();

  return () => {
    setTourStepData({
      step: 'welcome',
      agentId: '',
    });
  };
}

export function useStartQuickADETour() {
  const [, setTourStepData] = useQuickADETourStep();

  return (agentId: string) => {
    setTourStepData({
      step: 'message',
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

  const isTourActive = useMemo(() => {
    // if agent is set, tour is active
    return agentId === stepDetails.agentId && stepDetails.step !== 'welcome';
  }, [agentId, stepDetails]);

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
    isTourActive,
    currentStep,
    setStep,
    resetTour,
  };
}
