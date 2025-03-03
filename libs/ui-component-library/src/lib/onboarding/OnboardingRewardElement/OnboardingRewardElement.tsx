import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { ArrowUpwardAltIcon, LettaCoinIcon } from '../../icons';
import { Typography } from '../../core/Typography/Typography';

interface OnboardingRewardElementProps {
  showIndicator?: boolean;
  reward: number;
}

export function OnboardingRewardElement(props: OnboardingRewardElementProps) {
  const { showIndicator = true, reward } = props;
  return (
    <HStack align="center" gap={false}>
      <LettaCoinIcon />
      {showIndicator && <ArrowUpwardAltIcon />}{' '}
      <Typography>{reward}</Typography>
    </HStack>
  );
}
