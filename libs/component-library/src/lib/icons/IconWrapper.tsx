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
      success: 'text-success',
      violet: 'text-violet',
    },
    size: {
      xsmall: 'w-3 h-auto',
      small: 'w-4 h-auto',
      medium: 'w-5 h-auto',
      large: 'w-6 h-auto',
      xlarge: 'w-8 h-auto',
      xxlarge: 'w-10 h-auto',
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
