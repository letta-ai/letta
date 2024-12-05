'use client';
import * as React from 'react';
import { cn } from '@letta-web/core-style-config';
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

const defaultClass =
  'text-base text-text-secondary flex min-h-[40px] w-full border border-input bg-background px-3 py-2 pr-[10px] ring-offset-background placeholder:text-muted-foreground  disabled:cursor-not-allowed disabled:opacity-50';

const textareaVariants = cva(defaultClass, {
  variants: {
    resize: {
      both: 'resize',
      horizontal: 'resize-x',
      none: 'resize-none',
      vertical: 'resize-y',
    },
  },
  defaultVariants: {
    resize: 'none',
  },
});

type TextAreaProps = TextareaAutosizeProps &
  VariantProps<typeof textareaVariants> & {
    fullWidth?: boolean;
    fullHeight?: boolean;
    flex?: boolean;
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
      flex,
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
            textareaVariants({ resize }),
            defaultClass,
            hideFocus
              ? 'focus-visible:outline-none'
              : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className,
            fullHeight && 'h-full',
            fullWidth && 'w-full',
            flex && 'flex'
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

const WrappedTextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function WrappedTextArea(props, ref) {
    const { expandable, fullHeight, flex, fullWidth } = props;

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
              label={expandable.expandText}
              hideLabel
              color="tertiary-transparent"
              onClick={expandable.onExpand}
              preIcon={<ExpandTextareaIcon color="muted" />}
            />
          </div>
        )}
      </Frame>
    );
  }
);

export const TextArea = makeInput(WrappedTextArea, 'TextArea');
export const RawTextArea = makeRawInput(WrappedTextArea, 'RawTextArea');
