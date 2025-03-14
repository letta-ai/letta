'use client';
import * as React from 'react';
import type { PopoverProps } from '../../core/Popover/Popover';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { OnboardingRewardElement } from '../OnboardingRewardElement/OnboardingRewardElement';
import { Badge, type BadgeProps } from '../../core/Badge/Badge';
import { useTranslations } from '@letta-cloud/translations';
import { useCallback, useEffect, useMemo } from 'react';
import { OnboardingCheckbox } from '../OnboardingCheckbox/OnboardingCheckbox';
import { Button } from '../../core/Button/Button';
import { OnboardingSteps } from '../OnboardingSteps/OnboardingSteps';
import { createPortal } from 'react-dom';
import { Slot } from '@radix-ui/react-slot';
import { useDebouncedCallback } from '@mantine/hooks';

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
  onClick?: () => void;
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
    title,
    description,
    difficulty = 'easy',
    totalSteps = 1,
    currentStep = 1,
    reward = 100,
    isOpen,
    onClick,
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

  const elRef = React.useRef<HTMLDivElement>(null);

  // make sure the
  const [portalPosition, setPortalPosition] = React.useState({
    top: 0,
    left: 0,
  });
  const [overlaidButtonPosition, setOverlaidButtonPosition] = React.useState({
    top: 0,
    left: 0,
  });

  const overlayControllerRef = React.useRef<HTMLDivElement>(null);

  const calculateOverlayPositions = useCallback(() => {
    // make sure the portal is visible, prioritize it being right of the element
    // if it's not possible, place it below

    if (!overlayControllerRef.current) {
      return;
    }

    const el = elRef.current;

    if (!el) {
      return;
    }

    const rect = el.getBoundingClientRect();

    setOverlaidButtonPosition({
      top: rect.top,
      left: rect.left,
    });

    // get window width

    const windowWidth = window.innerWidth;

    const portalWidth = 350;

    // if the element is too close to the right edge of the screen, place the portal below
    if (rect.right + portalWidth > windowWidth) {
      setPortalPosition({
        top: rect.bottom + 10,
        left: rect.left,
      });
    } else {
      setPortalPosition({
        top: rect.top,
        left: rect.right + 10,
      });
    }

    overlayControllerRef.current.style.display = 'block';
  }, []);

  useEffect(() => {
    calculateOverlayPositions();
  }, [isOpen, calculateOverlayPositions]);

  const debouncedCalculation = useDebouncedCallback(
    calculateOverlayPositions,
    250,
  );

  const debouncedCalculationWrappFn = useCallback(() => {
    if (!overlayControllerRef.current) {
      return;
    }

    overlayControllerRef.current.style.display = 'hidden';

    debouncedCalculation();
  }, [debouncedCalculation]);

  // listen to window resize events
  useEffect(() => {
    window.addEventListener('resize', debouncedCalculationWrappFn);

    return () => {
      window.removeEventListener('resize', debouncedCalculationWrappFn);
    };
  }, [calculateOverlayPositions, debouncedCalculationWrappFn]);

  if (!isOpen) {
    return children;
  }

  return (
    <>
      <div className="fixed inset-0 z-dialog bg-black/30  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <Slot onClick={onClick} ref={elRef}>
        {children}
      </Slot>
      {createPortal(
        <div ref={overlayControllerRef}>
          {isOpen && (
            <>
              <div
                style={overlaidButtonPosition}
                className="fixed inset-0 z-dialog"
              >
                {children}
              </div>
              <VStack
                style={portalPosition}
                gap="large"
                padding
                color="background-grey"
                className="w-[350px] fixed z-dialog"
              >
                <HStack justify="spaceBetween" align="center">
                  <OnboardingRewardElement reward={reward} />
                  <Badge
                    content={
                      onboardingDifficultyTranslationMap[difficulty] || ''
                    }
                    variant={difficultyToBadgeVariant[difficulty]}
                  />
                </HStack>
                <OnboardingCheckbox size="large" label={title} />
                <Typography variant="large">{description}</Typography>
                <OnboardingSteps
                  currentStep={currentStep}
                  totalSteps={totalSteps}
                />
                <HStack>
                  <Button
                    label={t('tryLater')}
                    onClick={onDismiss}
                    color="tertiary"
                    bold
                  ></Button>
                </HStack>
              </VStack>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
