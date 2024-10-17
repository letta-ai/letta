'use client';
import * as React from 'react';
import { cn } from '@letta-web/core-style-config';
import { makeInput, makeRawInput } from '../Form/Form';
import TextareaAutosize, {
  type TextareaAutosizeProps,
} from 'react-textarea-autosize';

type TextAreaProps = TextareaAutosizeProps & {
  fullWidth?: boolean;
  fullHeight?: boolean;
  hideLabel?: boolean;
  autosize?: boolean;
  hideFocus?: boolean;
};

const defaultClass =
  'flex min-h-[80px] w-full border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground  disabled:cursor-not-allowed disabled:opacity-50';

const PrimitiveTextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      className,
      hideFocus,
      autosize = true,
      fullHeight,
      hideLabel: _hideLabel,
      fullWidth,
      ...props
    },
    ref
  ) => {
    if (!autosize) {
      return (
        <textarea
          className={cn(
            defaultClass,
            hideFocus
              ? 'focus-visible:outline-none'
              : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className,
            fullHeight && 'h-full',
            fullWidth && 'w-full'
          )}
          ref={ref}
          {...props}
        />
      );
    }

    return (
      <TextareaAutosize
        className={cn(defaultClass, className)}
        ref={ref}
        {...props}
      />
    );
  }
);

PrimitiveTextArea.displayName = 'Textarea';

export const TextArea = makeInput(PrimitiveTextArea, 'TextArea');
export const RawTextArea = makeRawInput(PrimitiveTextArea, 'RawTextArea');
