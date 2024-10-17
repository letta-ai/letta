'use client';
import * as React from 'react';
import { cn } from '@letta-web/core-style-config';
import { makeInput, makeRawInput } from '../Form/Form';
import TextareaAutosize, {
  type TextareaAutosizeProps,
} from 'react-textarea-autosize';

type TextAreaProps = TextareaAutosizeProps & {
  fullWidth?: boolean;
  hideLabel?: boolean;
};

const PrimitiveTextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, hideLabel: _hideLabel, fullWidth, ...props }, ref) => {
    return (
      <TextareaAutosize
        className={cn(
          'flex min-h-[80px] w-full border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

PrimitiveTextArea.displayName = 'Textarea';

export const TextArea = makeInput(PrimitiveTextArea, 'TextArea');
export const RawTextArea = makeRawInput(PrimitiveTextArea, 'RawTextArea');
