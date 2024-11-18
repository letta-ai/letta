import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import type { ButtonProps } from '../Button/Button';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../Typography/Typography';
import { cn } from '@letta-web/core-style-config';

export function MobileFooterNavigationButton(props: ButtonProps) {
  const { active } = props;
  return (
    <button
      onClick={props.onClick}
      className={cn(
        'flex flex-col items-center h-[54px] justify-center gap-2',
        active
          ? 'bg-tertiary-active text-tertiary-content'
          : 'bg-tertiary text-tertiary-content'
      )}
    >
      <Slot className="w-4 h-4">{props.preIcon}</Slot>
      <Typography variant="body3">{props.label}</Typography>
    </button>
  );
}

interface MobileFooterNavigationProps {
  children?: React.ReactNode;
}

export function MobileFooterNavigation(props: MobileFooterNavigationProps) {
  const { children } = props;

  return (
    <HStack
      justify="spaceBetween"
      className="transition-all grid gap-2 grid-cols-4"
      border
      padding="xxsmall"
    >
      {children}
    </HStack>
  );
}
