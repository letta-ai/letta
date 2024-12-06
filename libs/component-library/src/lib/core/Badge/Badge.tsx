import * as React from 'react';
import type { FrameProps } from '../../framing/Frame/Frame';
import { HStack } from '../../framing/HStack/HStack';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../Typography/Typography';

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
  className?: string;
  color?: FrameProps['color'];
}

export function Badge(props: BadgeProps) {
  const { size, className, preIcon, content } = props;

  return (
    <HStack
      className={cn(badgeVariants({ size }), className)}
      color={props.color || 'background-grey'}
      gap="small"
    >
      {preIcon && <Slot className="w-3 h-3">{preIcon}</Slot>}
      <Typography variant="body2" bold>
        {content}
      </Typography>
    </HStack>
  );
}
