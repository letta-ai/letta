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
        small:
          'text-[0.625rem] gap-1 rounded-[2px] h-[16px] max-h-[16px] font-semibold px-1',
        large: 'text-sm h-[24px] max-h-[24px]',
      },
      border: {
        true: 'border',
      },
      variant: {
        default:
          'bg-background-grey2 text-background-grey2-content border-background-grey2-border',
        warning:
          'bg-background-warning text-background-warning-content border-background-warning-border',
        destructive:
          'bg-background-destructive text-background-destructive-content',
        success: 'bg-background-success text-background-success-content',
        info: 'text-brand-light-content bg-brand-light',
        chipStandard:
          'bg-chip-standard text-chip-standard-content border-chip-standard-border',
        chipPremium:
          'bg-chip-premium text-chip-premium-content border-chip-premium-border',
        chipUsageBased:
          'bg-chip-usage-based text-chip-usage-based-content border-chip-usage-based-border',
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

const iconVariants = cva('', {
  variants: {
    size: {
      default: 'w-3 h-3',
      small: 'max-w-3 max-h-3',
      large: 'w-4 h-4',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

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
      {preIcon && <Slot className={iconVariants({ size })}>{preIcon}</Slot>}
      <span className="whitespace-nowrap bold">{content}</span>
    </HStack>
  );
}
