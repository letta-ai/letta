'use client';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import type { HTMLElementType } from 'react';

const radioDotVariants = cva('rounded-full  flex items-center justify-center', {
  variants: {
    variant: {
      lsd: 'border-bone',
      bullseye: 'border bg-transparent',
      default: 'border bg-transparent',
      filled: 'bg-background-grey3',
    },
    color: {
      brand: '',
    },
    size: {
      small: 'min-w-2 min-h-2 w-2 h-2',
      medium: 'min-w-4 min-h-4 w-4 h-4',
      large: 'min-w-6 min-h-6 w-6 h-6',
      grow: 'min-w-full min-h-full w-full h-full',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'medium',
    color: 'brand',
  },
});

const radioDotInnerVariants = cva(
  'rounded-full opacity-0 flex items-center justify-center',
  {
    variants: {
      checked: {
        true: 'opacity-100',
      },
      variant: {
        lsd: 'bg-background-grey3 w-[50%] h-[50%] opacity-100 min-w-[100%] min-h-[100%] border-background-grey3 border bg-transparent',
        bullseye: 'bg-brand w-[100%] h-[100%]',
        default: 'bg-brand w-[90%] h-[90%]',
        filled: 'bg-brand w-[100%] h-[100%]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
    compoundVariants: [
      {
        checked: true,
        variant: 'lsd',
        /* Hack to override the border color */
        className: 'border-x-brand border-y-brand',
      },
    ],
  },
);

const radioDotEvenMoreInnerVariants = cva('rounded-full opacity-0', {
  variants: {
    checked: {
      true: 'opacity-100',
    },
    variant: {
      lsd: 'min-w-[60%] min-h-[60%] opacity-100 bg-background-grey3',
      bullseye: 'bg-white min-w-[50%] min-h-[50%]',
      default: 'hidden',
      filled: 'hidden',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
  compoundVariants: [
    {
      checked: true,
      variant: 'lsd',
      className: 'bg-brand',
    },
  ],
});

export interface RadioDotProps extends VariantProps<typeof radioDotVariants> {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  Indicator?: HTMLElementType | any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Flexible component prop for custom indicators
  checked?: boolean;
}

export function RadioDot(props: RadioDotProps) {
  const { Indicator, ...rest } = props;

  return (
    <div className={radioDotVariants(rest)}>
      {Indicator ? (
        <Indicator
          className={radioDotInnerVariants({ ...rest, checked: true })}
        >
          <div
            className={radioDotEvenMoreInnerVariants({
              ...rest,
              checked: true,
            })}
          />
        </Indicator>
      ) : (
        <div className={radioDotInnerVariants(rest)}>
          <div className={radioDotEvenMoreInnerVariants(rest)} />
        </div>
      )}
    </div>
  );
}
