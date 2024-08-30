import * as React from 'react';
import { cn } from '@letta-web/core-style-config';

export type InputPrimitiveProps = React.InputHTMLAttributes<HTMLInputElement>;

const InputPrimitive = React.forwardRef<HTMLInputElement, InputPrimitiveProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-[36px] px-3 py-2 w-full rounded-md border border-input bg-transparent text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
InputPrimitive.displayName = 'Input';

export { InputPrimitive };
