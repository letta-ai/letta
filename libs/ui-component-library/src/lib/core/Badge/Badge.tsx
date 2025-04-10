import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-cloud/ui-styles';
import { Slot } from '@radix-ui/react-slot';

const badgeVariants = cva(
  'items-center px-1.5 inline-flex font-semibold tracking-wide',
  {
    variants: {
      size: {
        default: 'text-xs  h-[18px] max-h-[16px]',
        small: 'text-[0.625rem]  h-[16px] max-h-[16px] font-semibold',
        large: 'text-sm h-[24px] max-h-[24px]',
      },
      border: {
        true: 'border',
      },
      variant: {
        default: 'bg-background-grey2 text-background-grey2-content',
        warning: 'bg-background-warning text-background-warning-content',
        destructive:
          'bg-background-destructive text-background-destructive-content',
        success: 'bg-background-success text-background-success-content',
        info: 'text-brand-light-content bg-brand-light',
      },
      uppercase: {
        true: 'uppercase',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  },
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  content: React.ReactNode;
  preIcon?: React.ReactNode;
  className?: string;
  uppercase?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

export function Badge(props: BadgeProps) {
  const { size, className, border, ref, preIcon, variant, uppercase, content } =
    props;

  return (
    <HStack
      ref={ref}
      className={cn(
        badgeVariants({ size, border, uppercase, variant }),
        className,
      )}
      gap="small"
    >
      {preIcon && <Slot className="w-3 h-3">{preIcon}</Slot>}
      <span className="whitespace-nowrap bold">{content}</span>
    </HStack>
  );
}
