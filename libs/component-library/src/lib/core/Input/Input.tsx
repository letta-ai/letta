'use client';
import * as React from 'react';
import { makeRawInput, makeInput } from '../Form/Form';
import { cn } from '@letta-web/core-style-config';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { useCopyToClipboard } from '../../hooks';
import { Button } from '../Button/Button';
import { CheckIcon, ClipboardIcon } from '../../icons';

const inputVariants = cva(
  'flex gap-2 px-3 items-center w-full rounded-md border border-input text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-content focus-visible:outline-none focus-within:ring-1 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      color: {
        default: 'bg-background text-background-content',
        grey: 'bg-background-grey text-background-content',
      },
      size: {
        default: 'h-biHeight',
        small: 'h-biHeight-sm',
        large: 'h-biHeight-lg',
      },
      fullWidth: {
        true: 'w-full',
        false: 'w-auto',
      },
    },
    defaultVariants: {
      color: 'default',
      size: 'default',
    },
  }
);

type InputPrimitiveProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size'
> &
  VariantProps<typeof inputVariants> & {
    preIcon?: React.ReactNode;
    hideLabel?: boolean;
    allowCopy?: boolean;
  };

interface CopyButtonProps {
  text: string;
}

function CopyButton({ text }: CopyButtonProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({
    textToCopy: text,
  });

  return (
    <Button
      onClick={copyToClipboard}
      color="tertiary-transparent"
      label="Copy"
      hideLabel
      size="small"
      preIcon={isCopied ? <CheckIcon /> : <ClipboardIcon />}
    />
  );
}

const InputPrimitive = React.forwardRef<HTMLInputElement, InputPrimitiveProps>(
  (
    {
      className,
      hideLabel,
      fullWidth,
      allowCopy,
      preIcon,
      type,
      size,
      color,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn(inputVariants({ fullWidth, size, color, className }))}>
        <Slot className="w-4 h-auto">{preIcon}</Slot>
        <input
          type={type}
          className="w-full h-full focus:outline-none"
          ref={ref}
          {...props}
        />
        {allowCopy && <CopyButton text={(props.value || '').toString()} />}
      </div>
    );
  }
);

export const Input = makeInput(InputPrimitive, 'Input');
export const RawInput = makeRawInput(InputPrimitive, 'RawInput');
