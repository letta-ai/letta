import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@letta-cloud/core-style-config';
import { ButtonPrimitive } from '../../../primitives';
import { forwardRef } from 'react';

const buttonVariants = cva(
  'px-9 py-2.5 cursor-pointer items-center inline-flex gap-3',
  {
    variants: {
      variant: {
        primary: 'bg-foreground bg-background-hover',
        secondary:
          'bg-transparent text-muted border-muted border border-solid hover:text-white hover:border-white transition-colors',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
);

export type MarketingButtonProps = React.HTMLAttributes<
  HTMLAnchorElement | HTMLButtonElement
> &
  VariantProps<typeof buttonVariants> & {
    href?: string;
    target?: string;
    label?: string;
    preIcon?: React.ReactNode;
  };

export const MarketingButton = forwardRef<
  HTMLButtonElement,
  MarketingButtonProps
>(function MarketingButton(
  { className, preIcon, variant, label, ...props },
  ref,
) {
  return (
    <ButtonPrimitive
      ref={ref}
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    >
      {preIcon}
      {label}
    </ButtonPrimitive>
  );
});
