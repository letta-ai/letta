import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { SpinnerPrimitive } from '../../../primitives';
import { cn } from '@letta-web/core-style-config';

const spinnerVariants = cva('', {
  variants: {
    size: {
      default: '',
      small: 'min-w-4 min-h-4 w-4 h-4',
      medium: 'min-w-8 min-h-8 w-8 h-8',
      large: 'min-w-[64px] min-h-[64px] w-[64px] h-[64px]',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

type SpinnerProps = VariantProps<typeof spinnerVariants>;

export function Spinner(props: SpinnerProps) {
  return <SpinnerPrimitive className={cn(spinnerVariants(props))} />;
}
