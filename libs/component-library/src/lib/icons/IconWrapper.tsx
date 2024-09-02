import type * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';

const iconWrapperVariants = cva('inline-flex items-center justify-center', {
  variants: {
    color: {
      primary: 'text-primary',
      inherit: 'text-inherit',
      warning: '!text-warning',
      default: 'text-content',
    },
  },
  defaultVariants: {
    color: 'inherit',
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
