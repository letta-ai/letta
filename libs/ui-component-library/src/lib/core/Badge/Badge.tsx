import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-cloud/ui-styles';
import { Slot } from '@radix-ui/react-slot';
import { Spinner } from '../Spinner/Spinner';

const badgeVariants = cva(
  'items-center px-1.5 inline-flex font-semibold tracking-wide',
  {
    variants: {
      size: {
        default: 'text-xs h-[18px] max-h-[16px] px-1 py-2.5 rounded-[2px]',
        xsmall: 'text-[0.5rem] gap-1 rounded-[2px] h-[12px] max-h-[12px] font-semibold px-1',
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
          'bg-chip-warning text-chip-warning-content border-chip-warning-border',
        destructive:
          'bg-chip-destructive text-chip-destructive-content border-chip-destructive-border',
        success:
          'bg-background-success text-background-success-content border-background-success-border',
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
      cursor: {
        default: 'cursor-default',
        pointer: 'cursor-pointer',
        'not-allowed': 'cursor-not-allowed',
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
      small: 'max-w-3 max-h-3 min-w-2 min-w-2',
      large: 'w-4 h-4',
      xsmall: 'w-2 h-2',
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
  busy?: boolean;
  uppercase?: boolean;
  cursor?: 'default' | 'not-allowed' | 'pointer';
  ref?: React.Ref<HTMLDivElement>;
}

export function Badge(props: BadgeProps) {
  const {
    size,
    busy,
    className,
    border,
    ref,
    preIcon,
    variant,
    uppercase,
    content,
    cursor,
  } = props;

  return (
    <HStack
      ref={ref}
      className={cn(
        badgeVariants({ size, border, uppercase, variant, cursor }),
        className,
      )}
      gap="small"
    >
      {preIcon && <Slot className={iconVariants({ size })}>{preIcon}</Slot>}
      <span className="whitespace-nowrap bold">{content}</span>
      {busy && (
        <Slot className={iconVariants({ size })}>
          <Spinner />
        </Slot>
      )}
    </HStack>
  );
}
