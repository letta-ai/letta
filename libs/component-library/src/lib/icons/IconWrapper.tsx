import type * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';

const iconWrapperVariants = cva('inline-flex items-center justify-center', {
  variants: {
    color: {
      primary: 'text-primary',
      inherit: 'text-inherit',
      white: 'text-white',
      black: 'text-black',
      destructive: 'text-destructive',
      warning: '!text-warning',
      default: 'text-content',
      muted: 'text-muted',
    },
    size: {
      small: 'w-4 h-4',
      medium: 'w-5 h-5',
      large: 'w-6 h-6',
    },
  },
  defaultVariants: {
    color: 'inherit',
    size: 'small',
  },
});

export interface IconWrapperProps
  extends VariantProps<typeof iconWrapperVariants> {
  children: React.ReactNode;
  className?: string;
}

export type IconWrappedProps = Omit<IconWrapperProps, 'children'>;

export function IconWrapper({
  children,
  className,
  ...props
}: IconWrapperProps) {
  return (
    <Slot className={iconWrapperVariants({ className, ...props })}>
      {children}
    </Slot>
  );
}
