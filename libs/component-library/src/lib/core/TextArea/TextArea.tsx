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

type TextAreaProps = TextareaAutosizeProps & {
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

const defaultClass =
  'flex min-h-[80px] w-full border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground  disabled:cursor-not-allowed disabled:opacity-50';

const PrimitiveTextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      className,
      hideFocus,
      autosize = true,
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

function WrappedTextArea(props: TextAreaProps) {
  const { expandable, fullHeight, fullWidth } = props;

  return (
    <Frame fullWidth={fullWidth} fullHeight={fullHeight} position="relative">
      <PrimitiveTextArea {...props} />
      {expandable && (
        <div className="absolute bottom-0 right-[15px]">
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

export const TextArea = makeInput(WrappedTextArea, 'TextArea');
export const RawTextArea = makeRawInput(WrappedTextArea, 'RawTextArea');
