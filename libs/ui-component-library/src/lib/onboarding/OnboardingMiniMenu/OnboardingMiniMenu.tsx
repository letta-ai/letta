import * as React from 'react';
import type { StaticImport } from 'next/dist/shared/lib/get-img-props';
import { HStack } from '../../framing/HStack/HStack';
import Image from 'next/image';
import { VStack } from '../../framing/VStack/VStack';
import { useTranslations } from '@letta-cloud/translations';
import { Typography } from '../../core/Typography/Typography';
import { cn } from '@letta-cloud/ui-styles';

interface OnboardingMiniMenuProps {
  totalSteps: number;
  currentStep: number;
  imageUrl: StaticImport | string;
}

export function OnboardingMiniMenu(props: OnboardingMiniMenuProps) {
  const { imageUrl, totalSteps = 4, currentStep = 2 } = props;

  const t = useTranslations('onboarding/OnboardingMiniMenu');

  return (
    <HStack align="center" className="shadow-lg max-w-[214px]">
      <Image width={48} height={48} src={imageUrl} alt="" />
      <VStack gap={false}>
        <Typography variant="body2" bold>
          {t('continue')}
        </Typography>
        <HStack>
          <Typography variant="body3" color="muted">
            {t('step', {
              currentStep: currentStep,
              totalSteps: totalSteps,
            })}
          </Typography>
          <HStack align="center">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'w-[4px] h-[4px] bg-border rounded-full',
                  index <= currentStep - 1 && 'bg-brand',
                )}
              />
            ))}
          </HStack>
        </HStack>
      </VStack>
    </HStack>
  );
}
