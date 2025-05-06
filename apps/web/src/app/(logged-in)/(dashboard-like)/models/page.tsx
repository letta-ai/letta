'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  DashboardPageLayout,
  OnboardingAsideFocus,
  TemplateIcon,
} from '@letta-cloud/ui-component-library';
import React, { useCallback } from 'react';
import { LettaManagedModels } from './_components/LettaManagedModels/LettaManagedModels';
import { BYOKModels } from './_components/BYOKModels/BYOKModels';
import {
  stepToRewardMap,
  TOTAL_PRIMARY_ONBOARDING_STEPS,
} from '@letta-cloud/types';
import { useSetOnboardingStep } from '@letta-cloud/sdk-web';

export default function ModelsPage() {
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

  return (
    <DashboardPageLayout title={t('title')} subtitle={t('description')}>
      <OnboardingAsideFocus
        placement="left-start"
        panelClassName="w-[300px]"
        reward={stepToRewardMap.about_credits}
        title={t('Onboarding.title')}
        description={t('Onboarding.description')}
        isOpen
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
        <BYOKModels />
        <LettaManagedModels />
      </OnboardingAsideFocus>
    </DashboardPageLayout>
  );
}
