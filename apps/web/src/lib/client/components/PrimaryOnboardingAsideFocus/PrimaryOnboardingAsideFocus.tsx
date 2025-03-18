import { type OnboardingStepsType, stepToRewardMap } from '@letta-cloud/types';
import { useTranslations } from '@letta-cloud/translations';
import { OnboardingAsideFocus } from '@letta-cloud/ui-component-library';
import React from 'react';
import { get } from 'lodash-es';
import { usePauseOnboarding } from '$web/client/components/usePauseOnboarding/usePauseOnboarding';
import { useShowOnboarding } from '$web/client/hooks/useShowOnboarding/useShowOnboarding';

interface PrimaryOnboardingAsideFocusProps {
  step: OnboardingStepsType;
  children: React.ReactNode;
}

interface DetailsType {
  reward: number;
  title: string;
  description: string;
  stepNumber: number;
}

function useStepDetails(step: OnboardingStepsType): DetailsType | null {
  const t = useTranslations('onboarding/PrimaryOnboarding');

  const ref = {
    create_template: {
      reward: stepToRewardMap.create_template || 0,
      title: t('CreateTemplate.title'),
      description: t('CreateTemplate.description'),
      stepNumber: 1,
    },
  } satisfies Partial<Record<OnboardingStepsType, DetailsType>>;

  return get(ref, step) as DetailsType;
}

export function PrimaryOnboardingAsideFocus(
  props: PrimaryOnboardingAsideFocusProps,
) {
  const { step, children } = props;
  const details = useStepDetails(step);

  const { pauseOnboarding } = usePauseOnboarding();
  const showOnboarding = useShowOnboarding(step);

  if (!showOnboarding) {
    return children;
  }

  if (!details) {
    return children;
  }

  return (
    <OnboardingAsideFocus
      align="start"
      side="right"
      reward={500}
      title={details.title}
      totalSteps={5}
      currentStep={1}
      difficulty="easy"
      description={details.description}
      onDismiss={pauseOnboarding}
      isOpen={showOnboarding}
    >
      {children}
    </OnboardingAsideFocus>
  );
}
