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
      small: 'text-[10px]  px-2 font-semibold',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  content: string;
  preIcon?: React.ReactNode;
  color?: FrameProps['color'];
}

export function Badge(props: BadgeProps) {
  const { size, preIcon, content } = props;

  return (
    <HStack
      className={cn(badgeVariants({ size }))}
      color={props.color || 'background-grey'}
    >
      {preIcon && <Slot className="w-4 h-4">{preIcon}</Slot>}
      {content}
    </HStack>
  );
}
