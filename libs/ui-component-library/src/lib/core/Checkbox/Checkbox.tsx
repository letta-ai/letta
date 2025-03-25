'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from '../../icons';
import { cn } from '@letta-cloud/ui-styles';
import { makeInput, makeRawInput } from '../Form/Form';
import { cva, type VariantProps } from 'class-variance-authority';

interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  fullWidth?: boolean;
}

const checkboxContainerVariants = cva('', {
  variants: {
    size: {
      large: 'h-5 w-5',
      default: 'h-4 w-4',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

const checkboxIconVariants = cva('', {
  variants: {
    size: {
      large: 'h-5 w-5',
      default: 'h-4 w-4',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

type CheckboxPropsWithVariants = CheckboxProps &
  VariantProps<typeof checkboxContainerVariants>;

const CheckboxBase = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxPropsWithVariants
>(({ className, fullWidth: _ignore, size, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer shrink-0  border ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      checkboxContainerVariants({ size }),
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn('flex items-center justify-center text-current')}
    >
      <CheckIcon className={checkboxIconVariants({ size })} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
CheckboxBase.displayName = CheckboxPrimitive.Root.displayName;

export const Checkbox = makeInput(CheckboxBase, 'Checkbox', {
  inline: 'reverse',
});
export const RawCheckbox = makeRawInput(CheckboxBase, 'RawCheckbox', {
  inline: 'reverse',
});
