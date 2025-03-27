'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@letta-cloud/ui-styles';
import {
  extractAndRemoveInputProps,
  makeInput,
  makeRawInput,
} from '../Form/Form';
import { cva, type VariantProps } from 'class-variance-authority';

const switchVariants = cva(
  'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand data-[state=unchecked]:bg-input',
  {
    variants: {
      size: {
        default: 'h-5 w-9',
        small: 'h-4 w-8',
        large: 'h-6 w-12',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

const thumbVariants = cva(
  'pointer-events-none block rounded-full bg-background dark:bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
  {
    variants: {
      size: {
        default: 'h-4 w-4',
        small: 'h-3 w-3',
        large: 'h-5 w-5',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

type SwitchProps = React.ComponentProps<typeof SwitchPrimitives.Root> &
  VariantProps<typeof switchVariants> & {
    reverse?: boolean;
    fullWidth?: boolean;
    ref?: React.Ref<typeof SwitchPrimitives.Root>;
  };

function SwitchPrimitive({
  className,
  reverse: _reverse,
  fullWidth: _fullWidth,
  ref,
  ...props
}: SwitchProps) {
  const rest = extractAndRemoveInputProps(props);

  return (
    <SwitchPrimitives.Root
      className={cn(switchVariants(props), className)}
      {...rest}
      ref={ref}
    >
      <SwitchPrimitives.Thumb className={cn(thumbVariants(props))} />
    </SwitchPrimitives.Root>
  );
}

export const Switch = makeInput(SwitchPrimitive, 'Switch', { inline: true });
export const RawSwitch = makeRawInput(SwitchPrimitive, 'RawSwitch', {
  inline: true,
});
