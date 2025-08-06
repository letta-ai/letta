'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  DashboardPageLayout,
  TemplateIcon,
} from '@letta-cloud/ui-component-library';
import { OnboardingAsideFocus } from '@letta-cloud/ui-ade-components';

import React, { useCallback } from 'react';
import { LettaManagedModels } from './_components/LettaManagedModels/LettaManagedModels';
import { BYOKModels } from './_components/BYOKModels/BYOKModels';
import { TOTAL_PRIMARY_ONBOARDING_STEPS } from '@letta-cloud/types';
import { useSetOnboardingStep } from '@letta-cloud/sdk-web';
import { useShowOnboarding } from '$web/client/hooks/useShowOnboarding/useShowOnboarding';

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

function OnboardingWrapper(props: OnboardingWrapperProps) {
  const { children } = props;

  const showOnboarding = useShowOnboarding('about_credits');
  const t = useTranslations('pages/models');

  const { setOnboardingStep } = useSetOnboardingStep();
  const [isLoading, setIsLoading] = React.useState(false);
  const handleNextStep = useCallback(() => {
    setIsLoading(true);
    setOnboardingStep({
      onboardingStep: 'create_template',
      stepToClaim: 'about_credits',
      onSuccess: () => {
        window.location.href = '/default-project';
      },
    });
  }, [setOnboardingStep]);

  if (showOnboarding) {
    return (
      <OnboardingAsideFocus
        placement="left-start"
        panelClassName="w-[300px]"
        title={t('Onboarding.title')}
        description={t('Onboarding.description')}
        isOpen={showOnboarding}
        totalSteps={TOTAL_PRIMARY_ONBOARDING_STEPS}
        currentStep={1}
        nextStep={
          <Button
            fullWidth
            preIcon={<TemplateIcon />}
            size="large"
            bold
            busy={isLoading}
            onClick={handleNextStep}
            label={t('Onboarding.nextStep')}
          />
        }
      >
        {children}
      </OnboardingAsideFocus>
    );
  }

  return children;
}

export default function ModelsPage() {
  const t = useTranslations('pages/models');

  return (
    <DashboardPageLayout title={t('title')} subtitle={t('description')}>
      <OnboardingWrapper>
        <BYOKModels />
        <LettaManagedModels />
      </OnboardingWrapper>
    </DashboardPageLayout>
  );
}
