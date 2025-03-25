import type { StackPrimitiveProps } from '../../../primitives';
import { StackPrimitive } from '../../../primitives';
import { cn } from '@letta-cloud/ui-styles';
import * as React from 'react';
import type { ElementRef } from 'react';
import { forwardRef } from 'react';

export type DynamicStackProps = StackPrimitiveProps;

export const DynamicStack = forwardRef<
  ElementRef<typeof StackPrimitive>,
  DynamicStackProps
>(function DynamicStack({ className, children, ...props }, ref) {
  return (
    <StackPrimitive
      ref={ref}
      className={cn('largerThanMobile:flex-row flex-col', className)}
      {...props}
    >
      {children}
    </StackPrimitive>
  );
});
