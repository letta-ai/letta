'use client';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import type { SetStateAction, Dispatch } from 'react';
import { Frame } from '../../framing/Frame/Frame';
import { HStack } from '../../framing/HStack/HStack';
import { cn } from '@letta-cloud/ui-styles';
import { LettaLoader } from '../../core/LettaLoader/LettaLoader';
import { Typography } from '../../core/Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import TextareaAutosize from 'react-textarea-autosize';
import { Button } from '../../core/Button/Button';
import { SendIcon, ThinkingIcon } from '../../icons';
import { Popover } from '../../core/Popover/Popover';
import { useTranslations } from '@letta-cloud/translations';
import { Slot } from '@radix-ui/react-slot';
import { CopyWithCodePreview } from '../CopyWithCodePreview/CopyWithCodePreview';
import { HiddenOnMobile } from '../../framing/HiddenOnMobile/HiddenOnMobile';
import { VisibleOnMobile } from '../../framing/VisibleOnMobile/VisibleOnMobile';

export interface RoleOption {
  value: string;
  label: string;
  identityId?: string;
  icon?: React.ReactNode;
  color?: {
    text: string;
    background: string;
  };
}

interface ChatInputProps {
  onSendMessage: (role: RoleOption, message: string) => void;
  isSendingMessage: boolean;
  disabled?: boolean;
  hasFailedToSendMessageText?: React.ReactNode;
  roles: RoleOption[];
  getSendSnippet?: (role: RoleOption, message: string) => string | undefined;
  sendingMessageText?: string;
}

export interface ChatInputRef {
  setChatMessage: (message: string) => void;
}

interface CopySendMessageRequestButtonProps {
  code: string;
}

function CopySendMessageRequestButton(
  props: CopySendMessageRequestButtonProps,
) {
  const { code } = props;
  const t = useTranslations('ui-component-library/reusable/ChatInput');

  return (
    <CopyWithCodePreview
      copyTextLabel={t('CopySendMessageRequestButton.label')}
      code={code}
      language="bash"
      align="center"
      side="top"
    />
  );
}

interface RoleSelectorProps {
  roles: RoleOption[];
  role: RoleOption;
  setRole: Dispatch<SetStateAction<RoleOption>>;
}

function RoleSelector(props: RoleSelectorProps) {
  const t = useTranslations('ui-component-library/reusable/ChatInput');
  const { roles, role, setRole } = props;
  const [open, setOpen] = useState(false);

  const selectedRole = useMemo(() => {
    if (role.identityId) {
      const byIdentity = roles.find((r) => r.identityId === role.identityId);
      if (byIdentity) return byIdentity;
    }

    return roles.find((r) => r.value === role.value);
  }, [role, roles]);

  if (roles.length <= 1) {
    return null;
  }

  return (
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
            {t('role.label', { role: selectedRole?.label || role.label })}
          </div>
          <span>{selectedRole?.label || role.label}</span>
        </button>
      }
    >
      <VStack gap={false}>
        {roles.map((r) => (
          <Button
            key={r.value + '_' + r.identityId}
            color="tertiary"
            label={r.label}
            preIcon={r.icon}
            onClick={() => {
              setOpen(false);
              setRole(r);
            }}
          />
        ))}
      </VStack>
    </Popover>
  );
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  function ChatInput(props: ChatInputProps, ref) {
    const {
      onSendMessage,
      disabled,
      roles,
      getSendSnippet,
      sendingMessageText,
      isSendingMessage,
      hasFailedToSendMessageText,
    } = props;
    const [text, setText] = useState('');
    const [role, setRole] = useState(roles?.[0]);
    const t = useTranslations('ui-component-library/reusable/ChatInput');

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
      [handleSendMessage],
    );

    const handleSubmit = useCallback(
      (e: React.FormEvent<HTMLElement>) => {
        e.preventDefault();
        handleSendMessage();
      },
      [handleSendMessage],
    );

    const sendSnippet = useMemo(() => {
      if (getSendSnippet) {
        return getSendSnippet(role, text);
      }

      return undefined;
    }, [getSendSnippet, role, text]);

    return (
      <Frame position="relative" paddingX="medium" paddingBottom>
        <HStack
          gap="small"
          align="center"
          position="absolute"
          className={cn(
            'mt-[-25px] fade-out-0 fade-in-10  transition-all duration-200 slide-in-from-bottom-10',
            isSendingMessage ? '' : 'mt-0 opacity-0',
          )}
        >
          <div>
            <ThinkingIcon color="muted" size="small" />
          </div>
          <Typography color="muted" bold>
            {sendingMessageText}
          </Typography>
        </HStack>

        <VStack
          color="panel-input-background"
          onSubmit={handleSubmit}
          as="form"
          className="relative focus-within:ring-ring focus-within:ring-1 ignore-focus-on-buttons"
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
              <Typography
                variant="body3"
                bold
                data-testid="chat-simulator-error"
              >
                {hasFailedToSendMessageText}
              </Typography>
            </VStack>
          )}
          <HiddenOnMobile checkWithJs>
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
                  <RoleSelector role={role} setRole={setRole} roles={roles} />
                </HStack>
                <HStack>
                  {sendSnippet && (
                    <CopySendMessageRequestButton code={sendSnippet} />
                  )}
                  <Button
                    data-testid="chat-simulator-send"
                    type="submit"
                    color="primary"
                    preIcon={<SendIcon />}
                    disabled={isSendingMessage || disabled}
                    label={t('send')}
                  />
                </HStack>
              </HStack>
            </VStack>
          </HiddenOnMobile>
          <VisibleOnMobile checkWithJs>
            <HStack fullWidth padding>
              <HStack justify="end" fullWidth align="center">
                <TextareaAutosize
                  className="w-full bg-transparent text-base font-inherit resize-none	focus:outline-none"
                  data-testid="chat-simulator-input"
                  onChange={(e) => {
                    setText(e.target.value);
                  }}
                  value={text}
                  onFocus={(e) => {
                    if (!e.target) {
                      return;
                    }

                    e.target.style.opacity = '0';
                    setTimeout(() => (e.target.style.opacity = '1'));
                  }}
                  onKeyDown={handleKeyPress}
                  maxRows={3}
                  minRows={1}
                  placeholder={t('placeholder')}
                />
              </HStack>
              <Button
                data-testid="chat-simulator-send"
                type="submit"
                color="secondary"
                hideLabel
                preIcon={<SendIcon />}
                disabled={isSendingMessage || disabled}
                label={t('send')}
              />
            </HStack>
          </VisibleOnMobile>
        </VStack>
      </Frame>
    );
  },
);
