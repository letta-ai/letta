'use client';

import * as React from 'react';
import * as RadixLabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

const labelVariants = cva(
  'text-base font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
);

const LabelPrimitive = React.forwardRef<
  React.ElementRef<typeof RadixLabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadixLabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <RadixLabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
LabelPrimitive.displayName = RadixLabelPrimitive.Root.displayName;

export { LabelPrimitive };
