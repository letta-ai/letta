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
import './Switch.scss';

const switchVariants = cva(
  'peer inline-flex shrink-0 p-[2px] border border-button-border bg-background-grey2 cursor-pointer items-center rounded-[2px]  transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
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
  'pointer-events-none h-full block uppercase items-center rounded-[2px] justify-center flex bg-primary text-primary-content data-[state=unchecked]:opacity-60 ring-0 transition-transform   data-[state=unchecked]:translate-x-0',
  {
    variants: {
      size: {
        default: ' w-5 text-[8px] data-[state=checked]:translate-x-[10px]',
        small: ' w-4 text-[6px] data-[state=checked]:translate-x-[10px] ',
        large: ' w-6 text-[10px] data-[state=checked]:translate-x-[18px]',
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
      <SwitchPrimitives.Thumb className={cn(thumbVariants(props), 'switch-thumb')}>
        <div className="switch-thumb-on">
          On
        </div>
        <div className="switch-thumb-off">
          Off
        </div>
      </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
  );
}

export const Switch = makeInput(SwitchPrimitive, 'Switch', { inline: true });
export const RawSwitch = makeRawInput(SwitchPrimitive, 'RawSwitch', {
  inline: true,
});
