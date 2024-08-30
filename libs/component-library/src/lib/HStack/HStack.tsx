import * as React from 'react';
import { cn } from '@letta-web/core-style-config';
import type { StackPrimitiveProps } from '../../primitives/StackPrimitive/StackPrimitive';
import { StackPrimitive } from '../../primitives/StackPrimitive/StackPrimitive';

export type HStackProps = StackPrimitiveProps;

export function HStack({ className, children, ...props }: HStackProps) {
  return (
    <StackPrimitive className={cn('flex-row', className)} {...props}>
      {children}
    </StackPrimitive>
  );
}
