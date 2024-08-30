import * as React from 'react';
import { cn } from '@letta-web/core-style-config';

const InputContainerPrimitive = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('flex flex-col gap-[6px]', className)}
      {...props}
    />
  );
});

InputContainerPrimitive.displayName = 'InputContainer';

export { InputContainerPrimitive };
