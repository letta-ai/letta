import type { FrameProps } from '../../lib/framing/Frame/Frame';
import { Frame } from '../../lib/framing/Frame/Frame';
import { cn } from '@letta-web/core-style-config';
import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
const stackVariants = cva('flex', {
  variants: {
    gap: {
      false: 'gap-0',
      text: 'gap',
      small: 'gap-1',
      true: 'gap-2',
      medium: 'gap-3',
      large: 'gap-4',
    },
    justify: {
      spaceBetween: 'justify-between',
      center: 'justify-center',
    },
    align: {
      center: 'items-center',
    },
  },
  defaultVariants: {
    gap: true,
  },
});

export type StackPrimitiveProps = React.PropsWithChildren<
  FrameProps & VariantProps<typeof stackVariants>
>;

export function StackPrimitive({
  className,
  gap,
  children,
  ...props
}: StackPrimitiveProps) {
  return (
    <Frame
      className={cn(stackVariants({ ...props, gap, className }))}
      {...props}
    >
      {children}
    </Frame>
  );
}
