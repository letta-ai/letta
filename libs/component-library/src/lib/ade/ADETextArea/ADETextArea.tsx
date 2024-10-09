'use client';
import * as React from 'react';
import { makeInput, makeRawInput } from '../../core/Form/Form';
import { ADEInputContainer } from '../_internal/ADEInputContainer/ADEInputContainer';
import { cn } from '@letta-web/core-style-config';
import { useCallback, useEffect, useRef } from 'react';
import { Frame } from '../../framing/Frame/Frame';
import { getTextareaCaretPosition } from '@letta-web/helpful-client-utils';

interface ADETextAreaPrimitiveProps
  extends Omit<React.ComponentProps<'textarea'>, 'className'> {
  fullHeight?: boolean;
}

const lineHeight = 1.5; // in rem

function ADETextAreaPrimitive(props: ADETextAreaPrimitiveProps) {
  const { fullHeight } = props;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const getSelectionPosition = useCallback(function () {
    if (textareaRef.current && barRef.current) {
      const caret = getTextareaCaretPosition(
        textareaRef.current,
        // @ts-expect-error - this is a valid property
        // eslint-disable-next-line @typescript-eslint/no-invalid-this
        this.selectionEnd
      );

      const scrollTop = textareaRef.current.scrollTop;

      barRef.current.style.visibility = 'visible';
      barRef.current.style.top = `${caret.top - scrollTop - 4}px`;
    }
  }, []);

  const hideBar = useCallback(() => {
    if (barRef.current) {
      barRef.current.style.visibility = 'hidden';
    }
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.addEventListener('selectionchange', getSelectionPosition);
    }

    return () => {
      if (textarea) {
        textarea.removeEventListener('selectionchange', getSelectionPosition);
      }
    };
  }, [getSelectionPosition]);

  return (
    <Frame position="relative" fullWidth fullHeight={fullHeight}>
      <Frame
        ref={barRef}
        position="absolute"
        className="w-full bg-background-grey left-0 z-[0] pointer-events-none"
        style={{ height: `${lineHeight}rem` }}
      />
      <textarea
        ref={textareaRef}
        {...props}
        /* Prevents autofill tools from annoying our users */
        autoComplete="off"
        onScroll={hideBar}
        data-lpignore="true"
        style={{ lineHeight: `${lineHeight}rem` }}
        data-form-type="other"
        className={cn(
          'w-full z-[1] h-biHeight relative leading-3 resize-none bg-transparent text-base focus:outline-none',
          props.disabled ? 'cursor-not-allowed' : '',
          fullHeight ? 'h-full' : ''
        )}
      />
    </Frame>
  );
}

export const ADETextArea = makeInput(ADETextAreaPrimitive, 'ADETextArea', {
  fullWidth: true,
  container: ADEInputContainer,
});

export const RawADETextArea = makeRawInput(
  ADETextAreaPrimitive,
  'RawADETextArea',
  {
    fullWidth: true,
    container: ADEInputContainer,
  }
);
