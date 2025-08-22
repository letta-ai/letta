'use client';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { SetStateAction, Dispatch, DragEvent } from 'react';
import { Frame } from '../../framing/Frame/Frame';
import { HStack } from '../../framing/HStack/HStack';
import { cn } from '@letta-cloud/ui-styles';
import { Typography } from '../../core/Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import TextareaAutosize from 'react-textarea-autosize';
import { Button } from '../../core/Button/Button';
import {
  ArrowUpIcon,
  CancelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ImagesModeIcon,
  SendIcon,
  ThinkingIcon,
  WarningIcon,
} from '../../icons';
import { Popover } from '../../core/Popover/Popover';
import { useTranslations } from '@letta-cloud/translations';
import { CopyWithCodePreview } from '../CopyWithCodePreview/CopyWithCodePreview';
import { HiddenOnMobile } from '../../framing/HiddenOnMobile/HiddenOnMobile';
import { ImagePreview } from '../../core/ImagePreview/ImagePreview';
import { VisibleOnMobile } from '../../framing/VisibleOnMobile/VisibleOnMobile';
import type { LettaUserMessageContentUnion } from '@letta-cloud/sdk-core';
import { useSearchParams } from 'next/navigation';
import { Alert } from '../../core/Alert/Alert';
import { modelSupportsImages as checkModelSupportsImages } from './modelCapabilities';

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

export interface ImageAttachment {
  id: string;
  file: File;
  previewUrl: string;
  base64Data: string;
  mediaType: string;
  errorType?: 'file-too-large' | 'unknown';
}

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

function validateImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type);
}

async function createImageAttachment(file: File): Promise<ImageAttachment> {
  const [base64Data, previewUrl] = await Promise.all([
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }),
    Promise.resolve(URL.createObjectURL(file)),
  ]);

  const maxFileSize = 5 * 1024 * 1024;
  const errorType = file.size > maxFileSize ? 'file-too-large' : undefined;

  return {
    id: `image-${Date.now()}-${Math.random()}`,
    file,
    previewUrl,
    base64Data,
    mediaType: file.type,
    errorType,
  };
}

function createContentFromChatInput(
  text: string,
  images: ImageAttachment[],
): LettaUserMessageContentUnion[] | string {
  if (images.length == 0) {
    return text;
  }
  const imageContent = images.map((image) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      data: image.base64Data,
      media_type: image.mediaType,
    },
  }));
  return [{ type: 'text' as const, text }, ...imageContent];
}

export interface ChatInputProps {
  errorActionButton?: React.ReactNode;
  onSendMessage: (
    role: RoleOption,
    content: LettaUserMessageContentUnion[] | string,
  ) => void;
  shine?: boolean;
  onStopMessage?: () => void;
  isSendingMessage: boolean;
  disabled?: boolean;
  hasFailedToSendMessageText?: React.ReactNode;
  roles: RoleOption[];
  getSendSnippet?: (
    role: RoleOption,
    content: LettaUserMessageContentUnion[] | string,
  ) => string | undefined;
  sendingMessageText?: string;
  modelHandle?: string;
}

export interface ChatInputRef {
  setChatMessage: (message: string) => void;
}

interface CopySendMessageRequestButtonProps {
  code: string;
  disabled?: boolean;
}

function CopySendMessageRequestButton(
  props: CopySendMessageRequestButtonProps,
) {
  const { code, disabled } = props;
  const t = useTranslations('ui-component-library/reusable/ChatInput');

  return (
    <CopyWithCodePreview
      copyTextLabel={t('CopySendMessageRequestButton.label')}
      code={code}
      language="bash"
      align="center"
      side="top"
      buttonProps={{
        disabled: disabled,
      }}
    />
  );
}

interface RoleSelectorProps {
  roles: RoleOption[];
  role: RoleOption;
  setRole: Dispatch<SetStateAction<RoleOption>>;
  disabled?: boolean;
}

function RoleSelector(props: RoleSelectorProps) {
  const _t = useTranslations('ui-component-library/reusable/ChatInput');
  const { roles, role, setRole, disabled } = props;
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
      align="end"
      triggerAsChild
      trigger={
        <Button
          style={{
            backgroundColor: selectedRole?.color?.background,
            color: selectedRole?.color?.text,
            paddingRight: 8,
          }}
          label={selectedRole?.label || role.label}
          color={open ? 'brand' : 'secondary'}
          postIcon={open ? <ChevronUpIcon /> : <ChevronDownIcon />}
          disabled={disabled}
        />
      }
    >
      <VStack gap={false}>
        {roles.map((r) => (
          <Button
            key={r.value + '_' + r.identityId}
            color="grey2"
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
      onStopMessage,
      shine,
      disabled,
      roles,
      errorActionButton: errorButton,
      getSendSnippet,
      sendingMessageText,
      isSendingMessage,
      hasFailedToSendMessageText,
      modelHandle,
    } = props;
    const searchParams = useSearchParams();

    const message = useMemo(() => {
      const messageParam = searchParams.get('message');
      return messageParam ? decodeURIComponent(messageParam) : '';
    }, [searchParams]);

    const [text, setText] = useState(message || '');
    const [role, setRole] = useState(roles?.[0]);
    const [images, setImages] = useState<ImageAttachment[]>([]);
    const [isDraggedOver, setIsDraggedOver] = useState(false);
    const hiddenFileInputRef = useRef<HTMLInputElement>(null);
    const t = useTranslations('ui-component-library/reusable/ChatInput');

    useImperativeHandle(ref, () => ({
      setChatMessage: (message) => {
        setText(message);
      },
    }));

    const handleAddImages = useCallback(async (files: FileList) => {
      const imageFiles = Array.from(files).filter(validateImageFile);

      if (imageFiles.length === 0) {
        return;
      }

      try {
        const newImageAttachments = await Promise.all(
          imageFiles.map(createImageAttachment),
        );
        setImages((prev) => [...prev, ...newImageAttachments]);
      } catch (error) {
        console.error('Failed to process images:', error);
      }
    }, []);

    const handleRemoveImage = useCallback((imageId: string) => {
      setImages((prev) => {
        const imageToRemove = prev.find((img) => img.id === imageId);
        if (imageToRemove) {
          URL.revokeObjectURL(imageToRemove.previewUrl);
        }
        return prev.filter((img) => img.id !== imageId);
      });
    }, []);

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggedOver(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggedOver(false);
    }, []);

    const handleDrop = useCallback(
      (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggedOver(false);

        // Handle file drops (from file system)
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          void handleAddImages(files);
          return;
        }

        // Handle image drops from websites/browsers
        const items = e.dataTransfer.items;
        if (items) {
          for (const item of Array.from(items)) {
            // Handle dropped images from web pages
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                const fileList = [file] as unknown as FileList;
                Object.defineProperty(fileList, 'length', { value: 1 });
                void handleAddImages(fileList);
                return;
              }
            }
          }
        }
      },
      [handleAddImages],
    );

    const handleFileInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          void handleAddImages(files);
        }
        if (hiddenFileInputRef.current) {
          hiddenFileInputRef.current.value = '';
        }
      },
      [handleAddImages],
    );

    const handleImageUploadClick = useCallback(() => {
      if (hiddenFileInputRef.current) {
        hiddenFileInputRef.current.click();
      }
    }, []);

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboardData = e.clipboardData;

        if (clipboardData?.items) {
          const items = Array.from(clipboardData.items);
          const imageItems = items.filter((item) =>
            item.type.startsWith('image/'),
          );

          if (imageItems.length > 0) {
            e.preventDefault();

            const files: File[] = [];
            imageItems.forEach((item) => {
              const file = item.getAsFile();
              if (file && validateImageFile(file)) {
                files.push(file);
              }
            });

            if (files.length > 0) {
              const fileList = files as unknown as FileList;
              Object.defineProperty(fileList, 'length', {
                value: files.length,
              });
              files.forEach((file, index) => {
                Object.defineProperty(fileList, index, { value: file });
              });
              void handleAddImages(fileList);
            }
          }
        }
      },
      [handleAddImages],
    );

    const handleSendMessage = useCallback(() => {
      if (isSendingMessage) {
        return;
      }

      if (disabled) {
        return;
      }
      if (text || images.length > 0) {
        setText('');
        setImages([]);

        // clear the query param
        const url = new URL(window.location.href);
        url.searchParams.delete('message');
        window.history.replaceState({}, '', url.toString());
        onSendMessage(role, createContentFromChatInput(text, images));
      }
    }, [isSendingMessage, disabled, text, onSendMessage, role, images]);

    const handleStopMessage = useCallback(() => {
      if (onStopMessage) {
        onStopMessage();
      }
    }, [onStopMessage]);

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
        return getSendSnippet(role, createContentFromChatInput(text, images));
      }

      return undefined;
    }, [getSendSnippet, role, text, images]);

    const hasImageErrors = useMemo(() => {
      return images.some((image) => !!image.errorType);
    }, [images]);

    const getErrorMessage = useCallback(
      (errorType: string): string => {
        switch (errorType) {
          case 'file-too-large':
            return t('image.fileTooLarge');
          case 'unknown':
            return t('image.uploadFailed');
          default:
            return t('image.uploadFailed');
        }
      },
      [t],
    );

    const modelSupportsImages = useMemo(() => {
      return checkModelSupportsImages(modelHandle);
    }, [modelHandle]);

    const showImageWarning = useMemo(() => {
      return (images.length > 0 || isDraggedOver) && !modelSupportsImages;
    }, [images.length, isDraggedOver, modelSupportsImages]);

    const shouldDisableSend = useMemo(() => {
      return (
        disabled ||
        isSendingMessage ||
        hasImageErrors ||
        (!text.trim() && images.length === 0)
      );
    }, [disabled, isSendingMessage, hasImageErrors, text, images.length]);

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
          className={cn(
            'relative focus-within:ring-ring focus-within:ring-1 ignore-focus-on-buttons transition-colors',
            !isDraggedOver && 'border border-t',
          )}
          style={
            isDraggedOver
              ? { border: '2px dotted hsl(var(--border-drag))' }
              : undefined
          }
          fullWidth
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {hasFailedToSendMessageText && (
            <HStack
              align="center"
              justify="spaceBetween"
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
              {errorButton}
            </HStack>
          )}
          <HiddenOnMobile checkWithJs>
            <VStack padding="large">
              {showImageWarning && (
                <Alert
                  variant="warning"
                  icon={<WarningIcon />}
                  title={t('image.modelDoesNotSupportImages')}
                />
              )}
              <TextareaAutosize
                data-testid="chat-simulator-input"
                onChange={(e) => {
                  setText(e.target.value);
                }}
                value={text}
                onKeyDown={handleKeyPress}
                onPaste={handlePaste}
                /* To prevent layout shift due to js load lag we explicitly set minrow height */
                className="w-full min-h-[42px] bg-transparent text-base font-inherit resize-none	focus:outline-none"
                maxRows={10}
                minRows={2}
                placeholder={
                  isDraggedOver ? t('image.dropImagesHere') : t('placeholder')
                }
              />
              {images.length > 0 && (
                <HStack gap="medium" wrap paddingTop="small">
                  {images.map((image) => {
                    return (
                      <ImagePreview
                        key={image.id}
                        id={image.id}
                        src={image.previewUrl}
                        alt={`Uploaded image ${image.id}`}
                        thumbnailMaxWidth={64}
                        thumbnailMaxHeight={64}
                        fixedSize
                        rounded={false}
                        onRemove={handleRemoveImage}
                        disabled={isSendingMessage || disabled || isDraggedOver}
                        error={
                          image.errorType
                            ? getErrorMessage(image.errorType)
                            : undefined
                        }
                      />
                    );
                  })}
                </HStack>
              )}

              {shine && (
                <div className="flex items-center justify-end mb-2 animate-bounce">
                  <Typography variant="heading5" color="positive">
                    {t('clickHere')}
                  </Typography>
                  <div className="flex items-center gap-1 text-primary w-[34px] justify-center">
                    <ArrowUpIcon
                      size="large"
                      className="transform rotate-180"
                      color="positive"
                    />
                  </div>
                </div>
              )}

              <HStack justify="spaceBetween">
                <Button
                  type="button"
                  color="tertiary"
                  hideLabel
                  preIcon={<ImagesModeIcon />}
                  onClick={handleImageUploadClick}
                  disabled={isSendingMessage || disabled || isDraggedOver}
                  label={t('image.uploadImages')}
                />
                <HStack>
                  {sendSnippet && (
                    <CopySendMessageRequestButton
                      code={sendSnippet}
                      disabled={disabled || isDraggedOver}
                    />
                  )}
                  <HStack gap={false}>
                    <RoleSelector
                      role={role}
                      setRole={setRole}
                      roles={roles}
                      disabled={disabled || isDraggedOver}
                    />
                    <HStack
                      // to avoid weird UI for border
                      style={{ marginLeft: '-1px' }}
                      className={cn(
                        isSendingMessage ? 'w-[36px]' : 'w-0',
                        'transition-width duration-500 overflow-hidden',
                      )}
                    >
                      <Button
                        data-testid="chat-simulator-stop"
                        type="button"
                        color="secondary"
                        preIcon={<CancelIcon />}
                        onClick={handleStopMessage}
                        disabled={disabled || isDraggedOver}
                        label={t('stop')}
                        hideLabel
                        square={true}
                      />
                    </HStack>
                    <Button
                      data-testid="chat-simulator-send"
                      type="submit"
                      color="primary"
                      _use_rarely_className={shine ? 'shine' : ''}
                      preIcon={<SendIcon />}
                      disabled={shouldDisableSend}
                      label={t('send')}
                      hideLabel
                      square={true}
                    />
                  </HStack>
                </HStack>
              </HStack>
            </VStack>
          </HiddenOnMobile>
          <VisibleOnMobile checkWithJs>
            <VStack fullWidth padding>
              {showImageWarning && (
                <Alert
                  variant="warning"
                  icon={<WarningIcon />}
                  title={t('image.modelDoesNotSupportImages')}
                />
              )}
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
              {isSendingMessage && (
                <Button
                  data-testid="chat-simulator-stop"
                  type="button"
                  color="secondary"
                  hideLabel
                  preIcon={<CancelIcon />}
                  onClick={handleStopMessage}
                  disabled={disabled}
                  label={t('stop')}
                />
              )}
              <Button
                data-testid="chat-simulator-send"
                type="submit"
                color="secondary"
                hideLabel
                preIcon={<SendIcon />}
                disabled={
                  disabled ||
                  isSendingMessage ||
                  (!text.trim() && images.length === 0)
                }
                label={t('send')}
              />
            </VStack>
          </VisibleOnMobile>
        </VStack>
        <input
          ref={hiddenFileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={handleFileInputChange}
        />
      </Frame>
    );
  },
);
