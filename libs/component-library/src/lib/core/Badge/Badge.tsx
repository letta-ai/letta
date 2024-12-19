import * as React from 'react';
import type { FrameProps } from '../../framing/Frame/Frame';
import { HStack } from '../../framing/HStack/HStack';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';
import { Slot } from '@radix-ui/react-slot';

const badgeVariants = cva('items-center flex', {
  variants: {
    size: {
      default: 'text-xs px-2 py-1',
      small: 'text-[10px]   px-1 font-semibold',
    },
    uppercase: {
      true: 'uppercase tracking-wide',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  content: string;
  preIcon?: React.ReactNode;
  className?: string;
  color?: FrameProps['color'];
  uppercase?: boolean;
}

export function Badge(props: BadgeProps) {
  const { size, className, preIcon, uppercase, content } = props;

  return (
    <HStack
      className={cn(badgeVariants({ size, uppercase }), className)}
      color={props.color || 'background-grey'}
      gap="small"
    >
      {preIcon && <Slot className="w-3 h-3">{preIcon}</Slot>}
      <span className="bold">{content}</span>
    </HStack>
  );
}
