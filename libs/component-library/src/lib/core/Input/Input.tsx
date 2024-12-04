'use client';
import * as React from 'react';
import { makeRawInput, makeInput } from '../Form/Form';
import { cn } from '@letta-web/core-style-config';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { useCopyToClipboard } from '../../hooks';
import { Button } from '../Button/Button';
import {
  CheckIcon,
  ClipboardIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  LockClosedIcon,
} from '../../icons';
import { useCallback, useMemo } from 'react';
import { SpinnerPrimitive } from '../../../primitives';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';

const inputVariants = cva(
  'flex  items-center overflow-hidden border border-input text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-content focus-visible:outline-none focus-within:ring-1 focus-within:ring-ring',
  {
    variants: {
      disabled: {
        true: '',
      },
      warned: {
        true: 'border-warning',
      },
      color: {
        transparent: 'bg-transparent text-content border-transparent',
        default: 'bg-background text-background-content',
        grey: 'bg-background-grey text-background-content',
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
    },
  }
);

const inputIconVariants = cva('', {
  variants: {
    size: {
      small: 'h-4 w-4',
      default: 'h-5 w-5',
      large: 'h-6 w-6',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

const innerInputVariants = cva('px-3 gap-2', {
  variants: {
    size: {
      default: 'h-biHeight',
      small: 'h-biHeight-sm',
      large: 'h-biHeight-lg',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

type InputPrimitiveProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size'
> &
  VariantProps<typeof innerInputVariants> &
  VariantProps<typeof inputVariants> & {
    preIcon?: React.ReactNode;
    postIcon?: React.ReactNode;
    bottomContent?: React.ReactNode;
    hideLabel?: boolean;
    allowCopy?: boolean;
    onNumericValueChange?: (value: number | undefined) => void;
    showVisibilityControls?: boolean;
    isUpdating?: boolean;
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
      warned,
      allowCopy,
      postIcon,
      isUpdating,
      preIcon,
      type,
      showVisibilityControls,
      size,
      onNumericValueChange,
      onChange,
      color,
      ...props
    },
    ref
  ) => {
    const [visibility, setVisibility] = React.useState(false);

    const handleOnChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (type === 'number') {
          if (e.target.value === '') {
            onNumericValueChange?.(undefined);
            return;
          }

          const value = parseFloat(e.target.value);

          if (Number.isNaN(value)) {
            return;
          }

          onNumericValueChange?.(value);
        }

        onChange?.(e);
      },
      [onChange, onNumericValueChange, type]
    );

    const typeOverride = useMemo(() => {
      if (showVisibilityControls) {
        return visibility ? type : 'password';
      }

      return type;
    }, [showVisibilityControls, visibility, type]);

    const postIconRender = useMemo(() => {
      if (disabled) {
        return <LockClosedIcon />;
      }

      return postIcon;
    }, [disabled, postIcon]);

    return (
      <VStack
        gap={false}
        fullWidth={fullWidth}
        className={cn(
          inputVariants({ disabled, warned, fullWidth, color, className })
        )}
      >
        <HStack
          align="center"
          className={cn(innerInputVariants({ size }))}
          fullWidth={fullWidth}
        >
          <Slot className={cn(inputIconVariants({ size }))}>{preIcon}</Slot>
          <input
            /* Prevents autofill tools from annoying our users */
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            {...props}
            onChange={handleOnChange}
            disabled={disabled}
            type={typeOverride}
            className="w-full h-full text-text-secondary text-base focus:outline-none bg-transparent"
            ref={ref}
          />
          {showVisibilityControls && (
            <Button
              onClick={() => {
                setVisibility((prev) => !prev);
              }}
              type="button"
              preIcon={visibility ? <EyeClosedIcon /> : <EyeOpenIcon />}
              color="tertiary-transparent"
              label={visibility ? 'Hide' : 'Show'}
              hideLabel
              size="small"
            />
          )}
          {isUpdating && <SpinnerPrimitive className="w-3 h-3" />}
          {allowCopy && (
            <CopyButton
              text={(props.value || props.defaultValue || '').toString()}
            />
          )}
          <Slot className={cn(inputIconVariants({ size }))}>
            {postIconRender}
          </Slot>
        </HStack>
      </VStack>
    );
  }
);

export const Input = makeInput(InputPrimitive, 'Input');
export const RawInput = makeRawInput(InputPrimitive, 'RawInput');
