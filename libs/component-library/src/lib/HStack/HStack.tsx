import * as React from 'react';
import { cn } from '@letta-web/core-style-config';
import type { StackPrimitiveProps } from '../../primitives';
import { StackPrimitive } from '../../primitives';

export type HStackProps = StackPrimitiveProps;

export function HStack({ className, children, ...props }: HStackProps) {
  return (
    <StackPrimitive className={cn('flex-row', className)} {...props}>
      {children}
    </StackPrimitive>
  );
}
