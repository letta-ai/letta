import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ButtonPrimitive } from '../../primitives';
import { cn } from '@letta-web/core-style-config';

const buttonVariants = cva(
  'rounded items-center cursor-pointer inline-flex gap-2 whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white border-primary border',
        secondary: 'bg-secondary text-secondary-foreground border',
        tertiary: 'bg-tertiary text-tertiary-foreground border',
      },
      size: {
        default: 'px-4 py-1 h-[32px] text-base font-medium',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export type ButtonProps = Omit<
  React.HTMLAttributes<HTMLAnchorElement | HTMLButtonElement> &
    VariantProps<typeof buttonVariants> & {
      preIcon?: React.ReactNode;
      label?: string;
    },
  'children'
>;

export function Button(props: ButtonProps) {
  const { preIcon, variant, className, label } = props;

  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    >
      {preIcon}
      {label}
    </ButtonPrimitive>
  );
}
