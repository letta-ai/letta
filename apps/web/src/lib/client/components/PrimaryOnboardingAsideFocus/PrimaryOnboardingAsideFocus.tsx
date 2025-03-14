import { type OnboardingStepsType, stepToRewardMap } from '@letta-cloud/types';
import { useTranslations } from '@letta-cloud/translations';
import { OnboardingAsideFocus } from '@letta-cloud/ui-component-library';
import React, { useMemo } from 'react';
import { get } from 'lodash-es';
import { useCurrentUser } from '$web/client/hooks';
import { useSetOnboardingStep } from '$web/client/hooks/useOnboarding/useSetOnboardingStep/useSetOnboardingStep';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

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

  const user = useCurrentUser();
  const { setOnboardingStep } = useSetOnboardingStep();
  const flags = useFeatureFlag('ONBOARDING');

  const isInTutorial = useMemo(() => {
    return user?.onboardingStatus?.currentStep === step;
  }, [user, step]);

  if (flags.isLoading || !flags.data) {
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
      onDismiss={() => {
        setOnboardingStep('skipped');
      }}
      isOpen={isInTutorial}
    >
      {children}
    </OnboardingAsideFocus>
  );
}
