import type { StackPrimitiveProps } from '../../primitives/StackPrimitive/StackPrimitive';
import { StackPrimitive } from '../../primitives/StackPrimitive/StackPrimitive';
import { cn } from '@letta-web/core-style-config';
import * as React from 'react';

export type VStackProps = StackPrimitiveProps;

export function VStack({ className, children, ...props }: VStackProps) {
  return (
    <StackPrimitive className={cn('flex-col', className)} {...props}>
      {children}
    </StackPrimitive>
  );
}
