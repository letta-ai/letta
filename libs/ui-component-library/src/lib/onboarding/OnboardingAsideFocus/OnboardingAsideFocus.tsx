'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { OnboardingRewardElement } from '../OnboardingRewardElement/OnboardingRewardElement';
import { Badge, type BadgeProps } from '../../core/Badge/Badge';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo } from 'react';
import { Button } from '../../core/Button/Button';
import { OnboardingSteps } from '../OnboardingSteps/OnboardingSteps';
import {
  autoUpdate,
  FloatingPortal,
  type Placement,
  useFloating,
} from '@floating-ui/react';
import { offset } from '@floating-ui/react';
import { cn } from '@letta-cloud/ui-styles';
import { usePauseOnboarding } from '@letta-cloud/sdk-web';

interface OnboardingAsideFocusProps {
  children: React.ReactNode;
  reward?: number;
  title: string;
  totalSteps: number;
  currentStep: number;
  difficulty: 'easy' | 'hard' | 'medium';
  description: React.ReactNode;
  spotlight?: boolean;
  className?: string;
  isOpen: boolean;
  nextStep?: React.ReactNode;
  placement?: Placement;
}

const difficultyToBadgeVariant: Record<string, BadgeProps['variant']> = {
  easy: 'success',
  medium: 'warning',
  hard: 'destructive',
} as const;

export function OnboardingAsideFocus(props: OnboardingAsideFocusProps) {
  const {
    children,
    title,
    className,
    description,
    difficulty = 'easy',
    totalSteps = 1,
    currentStep = 1,
    isOpen,
    spotlight,
    placement,
    nextStep,
    reward,
  } = props;

  const t = useTranslations('onboarding/OnboardingAsideFocus');

  const { pauseOnboarding } = usePauseOnboarding();

  const onboardingDifficultyTranslationMap = useMemo(
    () => ({
      easy: t('difficulty.easy'),
      medium: t('difficulty.medium'),
      hard: t('difficulty.hard'),
    }),
    [t],
  );

  const { refs, floatingStyles } = useFloating({
    placement,
    middleware: [offset(10)],
    whileElementsMounted: autoUpdate,
    open: isOpen,
  });

  if (!isOpen) {
    return children;
  }

  return (
    <>
      <div className="fixed top-0 w-[100dvw] h-[100dvh] left-0 z-[7] inset-0 bg-black bg-opacity-50" />
      <div
        className={cn('z-[9] bg-background relative', className)}
        ref={refs.setReference}
      >
        {children}
        {spotlight && (
          <div className="w-[100px] h-[100px] top-[-36px] left-[-36px] z-[-1] rounded-full bg-background absolute" />
        )}
      </div>
      <FloatingPortal>
        <VStack
          ref={refs.setFloating}
          style={floatingStyles}
          gap="large"
          padding
          color="background-grey"
          className="w-[350px] fixed z-[9] shadow-lg border"
        >
          <HStack justify="spaceBetween" align="center">
            {reward && <OnboardingRewardElement reward={reward} />}
            <Badge
              content={onboardingDifficultyTranslationMap[difficulty] || ''}
              variant={difficultyToBadgeVariant[difficulty]}
            />
          </HStack>
          <Typography variant="heading5">{title}</Typography>
          <Typography className="whitespace-pre-wrap" variant="large">
            {description}
          </Typography>
          <OnboardingSteps currentStep={currentStep} totalSteps={totalSteps} />
          <VStack align="center">
            {nextStep}
            <Button
              label={t('tryLater')}
              onClick={pauseOnboarding}
              color="tertiary"
              bold
              fullWidth
            ></Button>
          </VStack>
        </VStack>
      </FloatingPortal>
    </>
  );
}
