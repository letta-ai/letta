import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ButtonPrimitive, SpinnerPrimitive } from '../../../primitives';
import { cn } from '@letta-web/core-style-config';
import { useMemo } from 'react';

const buttonVariants = cva(
  'items-center cursor-pointer inline-flex gap-2 whitespace-nowrap transition-width duration-200 ease-in-out',
  {
    variants: {
      fullWidth: {
        true: 'w-full justify-center',
      },
      fullHeight: {
        true: 'h-full',
      },
      variant: {
        'inline-panel':
          'h-full px-3 text-base first:border-l-0 border-l last:border-r-0 border-r',
        default: 'rounded border',
      },
      color: {
        primary:
          'bg-primary hover:bg-primary-hover text-white border-transparent',
        secondary: 'bg-secondary text-secondary-content border-transparent',
        tertiary: 'bg-tertiary hover:bg-tertiary-hover text-tertiary-content ',
        destructive:
          'bg-destructive hover:bg-destructive-hover text-white border-transparent',
      },
      size: {
        default: 'px-4 py-1 h-[32px] text-base font-medium',
      },
      active: {
        true: '',
      },
    },
    compoundVariants: [
      {
        color: 'tertiary',
        active: true,
        className: 'bg-tertiary-dark',
      },
      {
        variant: 'inline-panel',
        className: 'h-full',
      },
    ],
    defaultVariants: {
      color: 'primary',
      variant: 'default',
      size: 'default',
    },
  }
);

export type ButtonProps = Omit<
  React.HTMLAttributes<HTMLAnchorElement | HTMLButtonElement> &
    VariantProps<typeof buttonVariants> & {
      preIcon?: React.ReactNode;
      label?: string;
      busy?: boolean;
    },
  'children' | 'className'
>;

export function Button(props: ButtonProps) {
  const {
    preIcon,
    label,
    color,
    busy,
    variant,
    active,
    fullWidth,
    fullHeight,
    ...rest
  } = props;

  const iconToRender = useMemo(() => {
    if (busy) {
      return <SpinnerPrimitive className="w-3 h-3" />;
    }

    return preIcon;
  }, [busy, preIcon]);

  return (
    <ButtonPrimitive
      className={cn(
        buttonVariants({ color, variant, fullWidth, fullHeight, active })
      )}
      {...rest}
    >
      {iconToRender}
      {label}
    </ButtonPrimitive>
  );
}
