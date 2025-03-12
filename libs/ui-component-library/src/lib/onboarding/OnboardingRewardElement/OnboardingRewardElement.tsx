import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { ArrowUpwardAltIcon, LettaCoinIcon } from '../../icons';
import { Typography } from '../../core/Typography/Typography';
import { Tooltip } from '../../core/Tooltip/Tooltip';
import { useTranslations } from '@letta-cloud/translations';
import { CrossedOut } from '../../reusable/CrossedOut/CrossedOut';

interface OnboardingRewardElementProps {
  showIndicator?: boolean;
  isClaimed?: boolean;
  reward: number;
}

export function OnboardingRewardElement(props: OnboardingRewardElementProps) {
  const { showIndicator = true, reward, isClaimed } = props;

  const t = useTranslations('onboarding/OnboardingRewardElement');
  const child = (
    <HStack align="center" className="text-primary" gap={false}>
      {showIndicator && <ArrowUpwardAltIcon />}
      <HStack gap="small">
        <LettaCoinIcon />
        <Typography>{reward}</Typography>
      </HStack>
    </HStack>
  );

  if (!isClaimed) {
    return child;
  }

  return (
    <Tooltip content={t('claimed')}>
      <CrossedOut>{child}</CrossedOut>
    </Tooltip>
  );
}
