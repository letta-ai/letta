import * as React from 'react';
import { Popover, type PopoverProps } from '../../core/Popover/Popover';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { OnboardingRewardElement } from '../OnboardingRewardElement/OnboardingRewardElement';
import { Badge, type BadgeProps } from '../../core/Badge/Badge';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo } from 'react';
import { OnboardingCheckbox } from '../OnboardingCheckbox/OnboardingCheckbox';
import { Button } from '../../core/Button/Button';
import { OnboardingSteps } from '../OnboardingSteps/OnboardingSteps';

interface OnboardingAsideFocusProps {
  children: React.ReactNode;
  reward: number;
  title: string;
  totalSteps: number;
  currentStep: number;
  difficulty: 'easy' | 'hard' | 'medium';
  description: string;
  onDismiss: () => void;
  isOpen: boolean;
  side?: PopoverProps['side'];
  align?: PopoverProps['align'];
}

const difficultyToBadgeVariant: Record<string, BadgeProps['variant']> = {
  easy: 'success',
  medium: 'warning',
  hard: 'destructive',
} as const;

export function OnboardingAsideFocus(props: OnboardingAsideFocusProps) {
  const {
    children,
    side,
    align,
    title,
    description,
    difficulty = 'easy',
    totalSteps = 1,
    currentStep = 1,
    reward = 100,
    isOpen,
    onDismiss,
  } = props;

  const t = useTranslations('onboarding/OnboardingAsideFocus');

  const onboardingDifficultyTranslationMap = useMemo(
    () => ({
      easy: t('difficulty.easy'),
      medium: t('difficulty.medium'),
      hard: t('difficulty.hard'),
    }),
    [t],
  );

  if (!isOpen) {
    return children;
  }

  return (
    <>
      <div className="fixed inset-0 z-dialog bg-black/30  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <Popover
        triggerAsChild
        side={side}
        align={align}
        trigger={
          <div
            className="z-dropdown relative bg-background cursor-default"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {children}
          </div>
        }
        open={isOpen}
      >
        <VStack
          gap="large"
          padding
          color="background-grey"
          className="w-[350px]"
        >
          <HStack justify="spaceBetween" align="center">
            <OnboardingRewardElement reward={reward} />
            <Badge
              content={onboardingDifficultyTranslationMap[difficulty] || ''}
              variant={difficultyToBadgeVariant[difficulty]}
            />
          </HStack>
          <OnboardingCheckbox size="large" label={title} />
          <Typography variant="large">{description}</Typography>
          <OnboardingSteps currentStep={currentStep} totalSteps={totalSteps} />
          <HStack>
            <Button
              label={t('tryLater')}
              onClick={onDismiss}
              color="tertiary"
              bold
            ></Button>
          </HStack>
        </VStack>
      </Popover>
    </>
  );
}
