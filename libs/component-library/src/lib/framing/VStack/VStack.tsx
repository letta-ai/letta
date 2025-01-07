import type { StackPrimitiveProps } from '../../../primitives';
import { StackPrimitive } from '../../../primitives';
import { cn } from '@letta-cloud/core-style-config';
import * as React from 'react';
import type { ElementRef } from 'react';
import { forwardRef } from 'react';

export type VStackProps = StackPrimitiveProps;

export const VStack = forwardRef<
  ElementRef<typeof StackPrimitive>,
  VStackProps
>(function VStack({ className, children, ...props }, ref) {
  return (
    <StackPrimitive ref={ref} className={cn('flex-col', className)} {...props}>
      {children}
    </StackPrimitive>
  );
});
