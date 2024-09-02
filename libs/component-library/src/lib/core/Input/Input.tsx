import * as React from 'react';
import { makeRawInput, makeInput } from '../Form/Form';
import { cn } from '@letta-web/core-style-config';
import { BASE_INPUT_HEIGHT } from '../../../constants';

type InputPrimitiveProps = React.InputHTMLAttributes<HTMLInputElement>;

const InputPrimitive = React.forwardRef<HTMLInputElement, InputPrimitiveProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex px-3 py-2 w-full rounded-md border border-input bg-transparent text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-content focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          BASE_INPUT_HEIGHT,
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

export const Input = makeInput(InputPrimitive, 'Input');
export const RawInput = makeRawInput(InputPrimitive, 'RawInput');
