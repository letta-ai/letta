'use client';
import * as React from 'react';
import { makeRawInput, makeInput } from '../Form/Form';
import { cn } from '@letta-cloud/ui-styles';
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
} from '../../icons';
import { useCallback, useMemo } from 'react';
import { SpinnerPrimitive } from '../../../primitives';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';

export const inputVariants = cva(
  'flex  items-center overflow-hidden border  text-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-content focus-visible:outline-none focus-within:ring-1 focus-within:ring-ring',
  {
    variants: {
      size: {
        default: 'h-inputHeight',
        small: 'h-biHeight-sm',
        large: 'h-biHeight-lg',
      },
      variant: {
        primary: 'text-default border-input',
        secondary: 'text-lighter font-light border-input',
        tertiary:
          'border-t-transparent border-x-transparent bg-transparent border-b-input',
      },
      disabled: {
        true: '',
      },
      readOnly: {
        true: 'cursor-not-allowed',
      },
      warned: {
        true: 'border-warning',
      },
      color: {
        transparent: 'bg-transparent text-content border-transparent',
        default: 'bg-panel-input-background text-background-content',
        grey: 'bg-background-grey text-background-content',
      },
      fullWidth: {
        true: 'w-full',
        false: 'w-auto',
      },
      width: {
        medium: 'w-full max-w-[400px]',
        large: 'w-full max-w-[600px]',
      },
    },
    compoundVariants: [
      {
        disabled: true,
        className:
          'cursor-not-allowed bg-background-grey text-background-content',
      },
      {
        variant: 'tertiary',
        className:
          'bg-transparent focus-within:ring-transparent focus-within:border-b-brand',
      },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'default',
      color: 'default',
    },
  },
);

const inputIconVariants = cva('', {
  variants: {
    size: {
      small: 'h-4 w-4',
      default: 'h-4 w-4',
      large: 'h-4 w-4',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

const innerInputVariants = cva('px-2 gap-2', {
  variants: {
    size: {
      default: 'h-inputHeight',
      small: 'h-biHeight-sm',
      large: 'h-biHeight-lg text-lg',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

const textInputVariants = cva(
  'w-full h-full  focus:outline-none bg-transparent',
  {
    variants: {
      size: {
        default: 'text-xs',
        small: 'text-xs',
        large: 'text-base',
      },
    },
  },
);

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
    readOnly?: boolean;
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
      onClick={() => {
        void copyToClipboard();
      }}
      color="tertiary"
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
      width,
      warned,
      allowCopy,
      variant,
      postIcon,
      isUpdating,
      preIcon,
      readOnly,
      type,
      showVisibilityControls,
      size,
      onNumericValueChange,
      onChange,
      color,
      ...props
    },
    ref,
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
      [onChange, onNumericValueChange, type],
    );

    const typeOverride = useMemo(() => {
      if (!showVisibilityControls) return type;

      if (visibility) {
        return type === 'password' ? 'text' : type;
      }

      return 'password';
    }, [showVisibilityControls, visibility, type]);

    const postIconRender = useMemo(() => {
      return postIcon;
    }, [postIcon]);

    return (
      <VStack
        gap={false}
        fullWidth={fullWidth}
        className={cn(
          inputVariants({
            disabled,
            width,
            size,
            warned,
            variant,
            readOnly,
            fullWidth,
            color,
            className,
          }),
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
            disabled={disabled || readOnly}
            type={typeOverride}
            className={textInputVariants({ size })}
            ref={ref}
          />
          {showVisibilityControls && (
            <Button
              onClick={() => {
                setVisibility((prev) => !prev);
              }}
              type="button"
              preIcon={visibility ? <EyeClosedIcon /> : <EyeOpenIcon />}
              color="tertiary"
              label={visibility ? 'Hide' : 'Show'}
              hideLabel
              size={size}
            />
          )}
          {isUpdating && <SpinnerPrimitive className="w-3 h-3" />}
          {allowCopy && (
            <CopyButton
              text={(props.value || props.defaultValue || '').toString()}
            />
          )}

          {postIcon && (
            <VStack paddingRight={'xsmall'}>
              <Slot className={cn(inputIconVariants({ size }), 'text-inherit')}>
                {postIconRender}
              </Slot>
            </VStack>
          )}
        </HStack>
      </VStack>
    );
  },
);

export type InputProps = Omit<InputPrimitiveProps, 'ref'>;

export const Input = makeInput(InputPrimitive, 'Input');
export const RawInput = makeRawInput(InputPrimitive, 'RawInput');
