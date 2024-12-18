'use client';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Frame } from '../../framing/Frame/Frame';
import { HStack } from '../../framing/HStack/HStack';
import { cn } from '@letta-web/core-style-config';
import { LettaLoader } from '../../core/LettaLoader/LettaLoader';
import { Typography } from '../../core/Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import TextareaAutosize from 'react-textarea-autosize';
import { Button } from '../../core/Button/Button';
import { SendIcon } from '../../icons';
import { Popover } from '../../core/Popover/Popover';
import { useTranslations } from 'next-intl';
import { Slot } from '@radix-ui/react-slot';

interface RoleOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: {
    text: string;
    background: string;
  };
}

interface ChatInputProps {
  onSendMessage: (role: string, message: string) => void;
  isSendingMessage: boolean;
  disabled?: boolean;
  defaultRole: string;
  hasFailedToSendMessageText?: string | undefined;
  roles: RoleOption[];
  sendingMessageText?: string;
}

export interface ChatInputRef {
  setChatMessage: (message: string) => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  function ChatInput(props: ChatInputProps, ref) {
    const {
      onSendMessage,
      disabled,
      roles,
      defaultRole,
      sendingMessageText,
      isSendingMessage,
      hasFailedToSendMessageText,
    } = props;
    const [text, setText] = useState('');
    const [role, setRole] = useState(defaultRole);
    const t = useTranslations('component-library/reusable/ChatInput');

    useImperativeHandle(ref, () => ({
      setChatMessage: (message) => {
        setText(message);
      },
    }));

    const handleSendMessage = useCallback(() => {
      if (isSendingMessage) {
        return;
      }

      if (disabled) {
        return;
      }
      if (text) {
        setText('');
        onSendMessage(role, text);
      }
    }, [isSendingMessage, disabled, text, onSendMessage, role]);

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

    const [open, setOpen] = useState(false);

    const selectedRole = useMemo(
      () => roles.find((r) => r.value === role),
      [role, roles]
    );

    return (
      <Frame position="relative" paddingX="medium" paddingBottom>
        <HStack
          gap="small"
          align="center"
          position="absolute"
          className={cn(
            'mt-[-25px] fade-out-0 fade-in-10 z-[0] transition-all duration-200 slide-in-from-bottom-10',
            isSendingMessage ? '' : 'mt-0 opacity-0'
          )}
        >
          <div>
            <LettaLoader variant="flipper" size="small" color="muted" />
          </div>
          <Typography color="muted" bold>
            {sendingMessageText}
          </Typography>
        </HStack>

        <VStack
          color="background"
          onSubmit={handleSubmit}
          as="form"
          className="z-[1] relative focus-within:ring-ring focus-within:ring-1"
          border
          fullWidth
          borderTop
        >
          {hasFailedToSendMessageText && (
            <VStack
              paddingX="small"
              paddingY="xsmall"
              className="z-[1]"
              color="destructive"
            >
              <Typography variant="body3" bold>
                {hasFailedToSendMessageText}
              </Typography>
            </VStack>
          )}
          <VStack padding="large">
            <TextareaAutosize
              data-testid="chat-simulator-input"
              onChange={(e) => {
                setText(e.target.value);
              }}
              value={text}
              onKeyDown={handleKeyPress}
              /* To prevent layout shift due to js load lag we explicitly set minrow height */
              className="w-full min-h-[84px] bg-transparent text-base font-inherit resize-none	focus:outline-none"
              maxRows={10}
              minRows={4}
              placeholder={t('placeholder')}
            />
            <HStack justify="spaceBetween">
              <HStack align="center" gap={false}>
                {roles.length > 1 && (
                  <Popover
                    className="w-auto"
                    open={open}
                    onOpenChange={setOpen}
                    side="top"
                    align="start"
                    triggerAsChild
                    trigger={
                      <button
                        style={{
                          backgroundColor: selectedRole?.color?.background,
                          color: selectedRole?.color?.text,
                        }}
                        className="flex bg-background-grey2 font-medium text-base h-biHeight gap-2 items-center px-4"
                      >
                        {selectedRole?.icon && (
                          <Slot className="w-5">{selectedRole.icon}</Slot>
                        )}
                        <div className="sr-only">
                          {t('role.label', { role })}
                        </div>
                        <span>{selectedRole?.label || role}</span>
                      </button>
                    }
                  >
                    <VStack gap={false}>
                      {roles.map((r) => (
                        <Button
                          key={r.value}
                          color="tertiary-transparent"
                          label={r.label}
                          preIcon={r.icon}
                          onClick={() => {
                            setOpen(false);
                            setRole(r.value);
                          }}
                        />
                      ))}
                    </VStack>
                  </Popover>
                )}
              </HStack>
              <Button
                data-testid="chat-simulator-send"
                type="submit"
                color="secondary"
                preIcon={<SendIcon />}
                disabled={isSendingMessage || disabled}
                label={t('send')}
              />
            </HStack>
          </VStack>
        </VStack>
      </Frame>
    );
  }
);
