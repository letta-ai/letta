import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';
import { cn } from '@letta-cloud/ui-styles';
import { useTranslations } from '@letta-cloud/translations';
import { Typography } from '../../core/Typography/Typography';
import './OnboardingSteps.scss';

interface OnboardingStepsProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingSteps(props: OnboardingStepsProps) {
  const { currentStep, totalSteps } = props;
  const t = useTranslations('onboarding/OnboardingSteps');

  return (
    <VStack gap="small" fullWidth>
      <HStack>
        <Typography variant="body3" color="muted">
          {t('step', {
            currentStep,
            totalSteps,
          })}
        </Typography>
      </HStack>
      <HStack gap="small">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'w-full h-[4px] rounded-[2px] overflow-hidden',
              'bg-gray-200',
            )}
          >
            {index < currentStep - 1 && (
              <div className="w-full h-full bg-brand"></div>
            )}
            {index === currentStep - 1 && (
              <div className="w-full h-full bg-brand"></div>
            )}
          </div>
        ))}
      </HStack>
    </VStack>
  );
}
