import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { CheckIcon } from '../../icons';
import { cn } from '@letta-cloud/ui-styles';
import { Typography } from '../../core/Typography/Typography';

interface OnboardingCheckboxProps {
  checked?: boolean;
  label: string;
  size?: 'default' | 'large';
}

export function OnboardingCheckbox(props: OnboardingCheckboxProps) {
  const { checked, label, size = 'default' } = props;
  return (
    <HStack gap="medium" align="center">
      <div
        className={cn(
          size === 'large' ? 'w-[26px] h-[26px]' : 'w-[20px] h-[20px]',
          'items-center justify-center flex',
          checked ? 'bg-brand text-brand-content' : 'bg-background border',
        )}
      >
        {checked ? (
          <CheckIcon size={size === 'large' ? 'large' : 'small'} />
        ) : (
          ''
        )}
      </div>
      <Typography variant={size === 'large' ? 'heading5' : 'heading6'}>
        {label}
      </Typography>
    </HStack>
  );
}
