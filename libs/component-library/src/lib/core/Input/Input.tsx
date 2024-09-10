'use client';
import * as React from 'react';
import { makeRawInput, makeInput } from '../Form/Form';
import { cn } from '@letta-web/core-style-config';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { useCopyToClipboard } from '../../hooks';
import { Button } from '../Button/Button';
import { CheckIcon, ClipboardIcon, EyeOpenIcon } from '../../icons';
import { useMemo } from 'react';
import { EyeOffIcon } from 'lucide-react';

const inputVariants = cva(
  'flex gap-2 px-3 items-center w-full rounded-md border border-input text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-content focus-visible:outline-none focus-within:ring-1 focus-within:ring-ring',
  {
    variants: {
      disabled: {
        true: '',
      },
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
    compoundVariants: [
      {
        disabled: true,
        className:
          'cursor-not-allowed bg-background-grey text-background-content',
      },
    ],
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
    showVisibilityControls?: boolean;
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
      type="button"
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
      disabled,
      allowCopy,
      preIcon,
      type,
      showVisibilityControls,
      size,
      color,
      ...props
    },
    ref
  ) => {
    const [visibility, setVisibility] = React.useState(false);

    const typeOverride = useMemo(() => {
      if (showVisibilityControls) {
        return visibility ? type : 'password';
      }

      return type;
    }, [showVisibilityControls, visibility, type]);

    return (
      <div
        className={cn(
          inputVariants({ disabled, fullWidth, size, color, className })
        )}
      >
        <Slot className="w-4 h-auto">{preIcon}</Slot>
        <input
          {...props}
          disabled={disabled}
          type={typeOverride}
          className="w-full h-full focus:outline-none bg-transparent"
          ref={ref}
        />
        {showVisibilityControls && (
          <Button
            onClick={() => {
              setVisibility((prev) => !prev);
            }}
            type="button"
            preIcon={visibility ? <EyeOffIcon /> : <EyeOpenIcon />}
            color="tertiary-transparent"
            label={visibility ? 'Hide' : 'Show'}
            hideLabel
            size="small"
          />
        )}
        {allowCopy && <CopyButton text={(props.value || '').toString()} />}
      </div>
    );
  }
);

export const Input = makeInput(InputPrimitive, 'Input');
export const RawInput = makeRawInput(InputPrimitive, 'RawInput');
