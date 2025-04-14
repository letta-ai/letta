'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { OnboardingRewardElement } from '../OnboardingRewardElement/OnboardingRewardElement';
import { useTranslations } from '@letta-cloud/translations';
import { useCallback, useEffect, useId } from 'react';
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
import { ConfirmPauseOnboardingDialog } from '../ConfirmPauseOnboardingDialog/ConfirmPauseOnboardingDialog';

interface OnboardingAsideFocusProps {
  children: React.ReactNode;
  reward?: number;
  title: string;
  totalSteps: number;
  currentStep: number;
  description: React.ReactNode;
  spotlight?: boolean;
  className?: string;
  isOpen: boolean;
  nextStep?: React.ReactNode;
  placement?: Placement;
}

export function OnboardingAsideFocus(props: OnboardingAsideFocusProps) {
  const {
    children,
    title,
    className,
    description,
    totalSteps = 1,
    currentStep = 1,
    isOpen,
    spotlight,
    placement,
    nextStep,
    reward,
  } = props;

  const t = useTranslations('onboarding/OnboardingAsideFocus');

  const { refs, floatingStyles } = useFloating({
    placement,
    middleware: [offset(10)],
    whileElementsMounted: autoUpdate,
    open: isOpen,
  });

  const elId = useId();

  const spotlightRef = React.useRef<HTMLDivElement>(null);

  const positionSpotlight = useCallback(() => {
    if (!isOpen) {
      return;
    }

    const el = document.getElementById(elId);
    const spotlight = spotlightRef.current;

    if (!el || !spotlight) {
      return;
    }

    const rect = el.getBoundingClientRect();

    const padding = 40;

    spotlight.style.position = 'fixed';
    const largerSize = Math.max(rect.width, rect.height);
    spotlight.style.width = `${largerSize + padding}px`;
    spotlight.style.height = `${largerSize + padding}px`;

    // center the spotlight account for the 20px padding
    const x = rect.left + rect.width / 2 - largerSize / 2 - padding / 2;
    const y = rect.top + rect.height / 2 - largerSize / 2 - padding / 2;

    spotlight.style.left = `${x}px`;
    spotlight.style.top = `${y}px`;
  }, [elId, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    positionSpotlight();

    window.addEventListener('resize', positionSpotlight);
    window.addEventListener('scroll', positionSpotlight, { passive: true });

    return () => {
      window.removeEventListener('resize', positionSpotlight);
      window.removeEventListener('scroll', positionSpotlight);
    };
  }, [positionSpotlight, isOpen]);

  if (!isOpen) {
    return children;
  }

  return (
    <>
      <div className="fixed top-0 w-[100dvw] h-[100dvh] left-0 z-[7] inset-0 bg-black bg-opacity-50" />
      <div
        id={elId}
        className={cn('z-[9] bg-background relative', className)}
        ref={refs.setReference}
      >
        {children}
        {spotlight && (
          <div
            ref={spotlightRef}
            // style={floatingStyles}
            className="z-[-1] rounded-full bg-background"
          />
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
          </HStack>
          <Typography variant="heading5">{title}</Typography>
          <Typography className="whitespace-pre-wrap" variant="large">
            {description}
          </Typography>
          <OnboardingSteps currentStep={currentStep} totalSteps={totalSteps} />
          <VStack align="center">
            {nextStep}
            <ConfirmPauseOnboardingDialog
              trigger={
                <Button
                  label={t('tryLater')}
                  color="tertiary"
                  bold
                  fullWidth
                ></Button>
              }
            />
          </VStack>
        </VStack>
      </FloatingPortal>
    </>
  );
}
