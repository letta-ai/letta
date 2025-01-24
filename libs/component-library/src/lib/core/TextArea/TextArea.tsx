'use client';
import * as React from 'react';
import { cn } from '@letta-cloud/core-style-config';
import { makeInput, makeRawInput } from '../Form/Form';
import TextareaAutosize, {
  type TextareaAutosizeProps,
} from 'react-textarea-autosize';
import { Button } from '../Button/Button';
import { ExpandTextareaIcon } from '../../icons';
import { Frame } from '../../framing/Frame/Frame';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { forwardRef } from 'react';
import { Skeleton } from '../Skeleton/Skeleton';
import { VStack } from '../../framing/VStack/VStack';

const defaultClass =
  'text-base flex min-h-[40px] w-full border border-input bg-background px-3 py-2 pr-[10px] ring-offset-background placeholder:text-muted-foreground  disabled:cursor-not-allowed disabled:opacity-50';

const textareaVariants = cva(defaultClass, {
  variants: {
    variant: {
      primary: 'text-text-default',
      secondary: 'text-text-lighter',
    },
    resize: {
      both: 'resize',
      horizontal: 'resize-x',
      none: 'resize-none',
      vertical: 'resize-y',
    },
  },
  defaultVariants: {
    variant: 'primary',
    resize: 'none',
  },
});

type TextAreaProps = TextareaAutosizeProps &
  VariantProps<typeof textareaVariants> & {
    fullWidth?: boolean;
    fullHeight?: boolean;
    'data-testid'?: string;
    flex?: boolean;
    isLoading?: boolean;
    hideLabel?: boolean;
    autosize?: boolean;

    hideFocus?: boolean;
    expandable?: {
      onExpand: () => void;
      expandText: string;
    };
  };

const PrimitiveTextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      className,
      hideFocus,
      autosize = true,
      resize = 'none',
      fullHeight,
      variant,
      flex,
      hideLabel: _hideLabel,
      fullWidth,
      ...props
    },
    ref,
  ) => {
    if (!autosize) {
      return (
        <textarea
          className={cn(
            textareaVariants({ resize, variant }),
            defaultClass,
            hideFocus
              ? 'focus-visible:outline-none'
              : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className,
            fullHeight && 'h-full',
            fullWidth && 'w-full',
            flex && 'flex',
          )}
          ref={ref}
          {...props}
        />
      );
    }

    return (
      <TextareaAutosize
        className={cn(
          defaultClass,
          textareaVariants({ resize, variant }),
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

PrimitiveTextArea.displayName = 'Textarea';

const WrappedTextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function WrappedTextArea(allProps, ref) {
    const { isLoading, ...props } = allProps;
    const { expandable, fullHeight, flex, fullWidth } = props;

    if (isLoading) {
      return (
        <VStack
          padding="small"
          border
          fullWidth={fullWidth}
          flex={flex}
          fullHeight={fullHeight}
        >
          <Skeleton className="w-[100%] h-[1rem]" />
          <Skeleton className="w-[80%] h-[1rem]" />
          <Skeleton className="w-[50%] h-[1rem]" />9
        </VStack>
      );
    }

    return (
      <Frame
        fullWidth={fullWidth}
        flex={flex}
        fullHeight={fullHeight}
        position="relative"
      >
        <PrimitiveTextArea ref={ref} {...props} />
        {expandable && (
          <div className="absolute bottom-[4px] right-[6px]">
            <Button
              size="small"
              data-testid={
                props['data-testid'] ? `expand-${props['data-testid']}` : ''
              }
              label={expandable.expandText}
              hideLabel
              color="tertiary"
              onClick={expandable.onExpand}
              preIcon={<ExpandTextareaIcon color="muted" />}
            />
          </div>
        )}
      </Frame>
    );
  },
);

export const TextArea = makeInput(WrappedTextArea, 'TextArea');
export const RawTextArea = makeRawInput(WrappedTextArea, 'RawTextArea');
