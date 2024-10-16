'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from '../../icons';
import { cn } from '@letta-web/core-style-config';
import { makeInput, makeRawInput } from '../Form/Form';

interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  fullWidth?: boolean;
}

const CheckboxBase = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, fullWidth: _ignore, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn('flex items-center justify-center text-current')}
    >
      <CheckIcon className="h-4 w-4" />
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
