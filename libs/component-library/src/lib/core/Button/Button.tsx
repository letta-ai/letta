import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ButtonPrimitive, SpinnerPrimitive } from '../../../primitives';
import { cn } from '@letta-web/core-style-config';
import { useMemo } from 'react';
import { Slot } from '@radix-ui/react-slot';

const buttonVariants = cva(
  'items-center cursor-pointer inline-flex  whitespace-nowrap transition-width duration-200 ease-in-out',
  {
    variants: {
      fullWidth: {
        true: 'w-full justify-center',
      },
      fullHeight: {
        true: 'h-full',
      },
      align: {
        center: 'justify-center',
        left: 'justify-start',
        right: 'justify-end',
      },
      variant: {
        'inline-panel':
          'h-full px-3 text-base first:border-l-0 border-l last:border-r-0 border-r',
        default: 'rounded border',
      },
      color: {
        'tertiary-transparent':
          'bg-transparent border-none hover:bg-tertiary-hover text-tertiary-content',
        primary:
          'bg-primary hover:bg-primary-hover text-white border-transparent',
        secondary: 'bg-secondary text-secondary-content border-transparent',
        tertiary: 'bg-tertiary hover:bg-tertiary-hover text-tertiary-content ',
        destructive:
          'bg-destructive hover:bg-destructive-hover text-white border-transparent',
        black:
          'bg-background-black text-background-black-content hover:bg-background-black-hover border-transparent',
      },
      size: {
        default: 'px-4 py-1 h-biHeight text-base font-medium gap-2',
        small: 'px-3 py-1 h-biHeight-sm text-sm font-medium gap-2',
      },
      active: {
        true: '',
      },
      hideLabel: {
        true: '',
      },
    },
    compoundVariants: [
      {
        color: 'tertiary',
        active: true,
        className: 'bg-tertiary-active',
      },
      {
        color: 'tertiary-transparent',
        active: true,
        className: 'bg-tertiary-active',
      },
      {
        variant: 'inline-panel',
        className: 'h-full',
      },
      {
        hideLabel: true,
        size: 'small',
        className: 'w-biWidth-sm p-0 items-center justify-center flex',
      },
      {
        hideLabel: true,
        size: 'default',
        className: 'w-biWidth p-0 items-center justify-center flex',
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
      postIcon?: React.ReactNode;
      label?: string;
      busy?: boolean;
      href?: string;
      hideLabel?: boolean;
      target?: string;
      type?: 'button' | 'reset' | 'submit';
    },
  'children' | 'className'
>;

export function Button(props: ButtonProps) {
  const {
    preIcon,
    postIcon,
    label,
    color,
    busy,
    variant,
    active,
    fullWidth,
    align,
    fullHeight,
    size,
    hideLabel,
    ...rest
  } = props;

  const iconSize = useMemo(() => {
    return size === 'small' ? 'w-3 h-3' : 'w-3 h-3';
  }, [size]);

  const iconToRender = useMemo(() => {
    if (busy) {
      return <SpinnerPrimitive className={iconSize} />;
    }

    return <Slot className={iconSize}>{preIcon}</Slot>;
  }, [iconSize, busy, preIcon]);

  return (
    <ButtonPrimitive
      className={cn(
        buttonVariants({
          color,
          hideLabel,
          align,
          size,
          variant,
          fullWidth,
          fullHeight,
          active,
        })
      )}
      {...rest}
    >
      {iconToRender}
      {hideLabel ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span>{label}</span>
      )}
      {postIcon && <Slot className={iconSize}>{postIcon}</Slot>}
    </ButtonPrimitive>
  );
}
