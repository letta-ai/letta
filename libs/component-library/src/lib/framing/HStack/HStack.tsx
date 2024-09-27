import * as React from 'react';
import { cn } from '@letta-web/core-style-config';
import type { StackPrimitiveProps } from '../../../primitives';
import { StackPrimitive } from '../../../primitives';
import { type ElementRef, forwardRef } from 'react';

export type HStackProps = StackPrimitiveProps;

export const HStack = forwardRef<
  ElementRef<typeof StackPrimitive>,
  HStackProps
>(function HStack({ className, children, ...props }, ref) {
  return (
    <StackPrimitive ref={ref} className={cn('flex-row', className)} {...props}>
      {children}
    </StackPrimitive>
  );
});
