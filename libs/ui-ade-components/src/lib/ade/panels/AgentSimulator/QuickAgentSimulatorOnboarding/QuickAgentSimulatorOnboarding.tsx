'use client';
import React from 'react';
import { OnboardingAsideFocus } from '../../../../OnboardingAsideFocus/OnboardingAsideFocus';
import { useTranslations } from '@letta-cloud/translations';
import { useQuickADETour } from '../../../../hooks/useQuickADETour/useQuickADETour';

interface QuickAgentSimulatorOnboardingProps {
  children: React.ReactNode;
}

export function QuickAgentSimulatorOnboarding(
  props: QuickAgentSimulatorOnboardingProps,
) {
  const t = useTranslations('ADE/AgentSimulator.QuickOnboarding');
  const { children } = props;

  const { currentStep } = useQuickADETour();

  if (currentStep !== 'message') {
    return <>{children}</>;
  }

  return (
    <OnboardingAsideFocus
      title={t('title')}
      placement="top-start"
      description={t('description')}
      isOpen
      totalSteps={4}
      currentStep={1}
    >
      {children}
    </OnboardingAsideFocus>
  );
}
