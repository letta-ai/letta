'use client';
import React, { useCallback, useState } from 'react';
import { Frame } from '../../framing/Frame/Frame';
import { HStack } from '../../framing/HStack/HStack';
import { cn } from '@letta-web/core-style-config';
import { LettaLoader } from '../../core/LettaLoader/LettaLoader';
import { Typography } from '../../core/Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import TextareaAutosize from 'react-textarea-autosize';
import { Button } from '../../core/Button/Button';
import { SendIcon } from '../../icons';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isSendingMessage: boolean;
  disabled?: boolean;
  sendingMessageText?: string;
}

export function ChatInput(props: ChatInputProps) {
  const { onSendMessage, disabled, sendingMessageText, isSendingMessage } =
    props;
  const [text, setText] = useState('');

  const handleSendMessage = useCallback(() => {
    if (isSendingMessage) {
      return;
    }

    if (disabled) {
      return;
    }
    if (text) {
      setText('');
      onSendMessage(text);
    }
  }, [isSendingMessage, disabled, onSendMessage, text]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLElement>) => {
      e.preventDefault();
      handleSendMessage();
    },
    [handleSendMessage]
  );

  return (
    <Frame position="relative" paddingX="medium" paddingBottom>
      <HStack
        gap="small"
        align="center"
        position="absolute"
        className={cn(
          'mt-[-25px] fade-out-0 fade-in-10 z-[0] transition-all duration-200 slide-in-from-bottom-10',
          isSendingMessage ? '' : 'mt-0'
        )}
      >
        <div>
          <LettaLoader size="small" color="muted" />
        </div>
        <Typography color="muted" bold>
          {sendingMessageText}
        </Typography>
      </HStack>
      <HStack
        color="background"
        onSubmit={handleSubmit}
        as="form"
        className="z-[1] relative focus-within:ring-ring focus-within:ring-1"
        rounded
        border
        fullWidth
        padding="large"
        borderTop
      >
        <TextareaAutosize
          data-testid="chat-simulator-input"
          onChange={(e) => {
            setText(e.target.value);
          }}
          value={text}
          onKeyDown={handleKeyPress}
          className="w-full bg-transparent text-base font-inherit resize-none	focus:outline-none"
          maxRows={10}
          minRows={4}
          placeholder="Type a message here"
        />
        <VStack justify="spaceBetween">
          <div />
          <Button
            data-testid="chat-simulator-send"
            size="small"
            type="submit"
            color="secondary"
            preIcon={<SendIcon />}
            disabled={isSendingMessage || disabled}
            label="Send"
          />
        </VStack>
      </HStack>
    </Frame>
  );
}
