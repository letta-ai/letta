import { Button, HStack, ImagesModeIcon, ImagePreview, SendIcon, VStack } from '@letta-cloud/ui-component-library';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { useTranslations } from '@letta-cloud/translations';
import type { LettaUserMessageContentUnion, SendMessageData } from '@letta-cloud/sdk-core';
import { useCurrentAgent } from '../../../../../hooks';
import { useImageAttachments } from './useImageAttachments';
import type { ImageAttachment } from './useImageAttachments';
import { CopySendMessageCode } from './CopySendMessageCode/CopySendMessageCode';
import { AgentMessengerRoleSelector } from './AgentMessengerRoleSelector/AgentMessengerRoleSelector';
import { useDefaultRole } from './useDefaultRole';

function createContentFromInput(
  text: string,
  images: ImageAttachment[],
): LettaUserMessageContentUnion[] | string {
  if (images.length === 0) {
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

  const trimmedText = text.trim();
  if (trimmedText) {
    return [{ type: 'text' as const, text: trimmedText }, ...imageContent];
  } else {
    return imageContent;
  }
}

interface AgentMessengerInputProps {
  onSendMessage: (payload: SendMessageData) => void;
  isSending?: boolean;
}

export function AgentMessengerInput(props: AgentMessengerInputProps) {
  const { onSendMessage, isSending = false } = props;
  const searchParams = useSearchParams();
  const { id: agentId } = useCurrentAgent();

  const message = useMemo(() => {
    const messageParam = searchParams.get('message');
    return messageParam ? decodeURIComponent(messageParam) : '';
  }, [searchParams]);

  const [text, setText] = useState(message || '');
  const defaultRole = useDefaultRole();
  const [role, setRole] = useState(defaultRole);

  const {
    images,
    isDraggedOver,
    hasImageErrors,
    hiddenFileInputRef,
    acceptedImageTypes,
    handleRemoveImage,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    handleImageUploadClick,
    handlePaste,
    clearImages,
  } = useImageAttachments();

  const t = useTranslations('AgentMessenger/AgentMessengerInput');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    // Don't send if text is empty and no images or already sending
    if ((!text.trim() && images.length === 0) || isSending || hasImageErrors) {
      return;
    }

    const content = createContentFromInput(text, images);

    // Send the message
    onSendMessage({
      agentId,
      requestBody: {
        messages: [
          {
            type: 'message',
            role: 'user',
            content
          }
        ]
      }
    });

    // Clear the input
    setText('');
    clearImages();
  }, [text, images, onSendMessage, agentId, isSending, hasImageErrors, clearImages]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  return (
    <form className="contents" onSubmit={handleSubmit}>
      <HStack fullWidth className="px-5 mb-[32px]">
        <VStack
          fullWidth
          className="shadow-sm p-3 rounded-md focus-within:border focus-within:border-primary"
          border
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={
            isDraggedOver
              ? { border: '2px dotted hsl(var(--border-drag))' }
              : undefined
          }
        >
          <TextareaAutosize
            className=" bg-transparent focus:outline-none text-sm resize-none"
            placeholder={isDraggedOver ? t('dropImagesHere') : t('placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            maxRows={5}
            minRows={2}
            disabled={isSending}
          />
          {images.length > 0 && (
            <HStack gap="medium" wrap>
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
                    disabled={isSending || isDraggedOver}
                    error={
                      image.errorType
                        ? image.errorType === 'file-too-large'
                          ? t('image.fileTooLarge')
                          : t('image.uploadFailed')
                        : undefined
                    }
                  />
                );
              })}
            </HStack>
          )}
          <HStack fullWidth justify="spaceBetween">
            <Button
              type="button"
              color="tertiary"
              hideLabel
              size="xsmall"
              _use_rarely_className="max-w-[24px] max-h-[24px]"
              preIcon={<ImagesModeIcon />}
              onClick={handleImageUploadClick}
              disabled={isSending || isDraggedOver}
              label={t('uploadImages')}
            />
            <HStack gap="small">
              <CopySendMessageCode
                agentId={agentId}
                text={text}
                senderId={role?.identityId}
                images={images}
                disabled={(!text.trim() && images.length === 0) || hasImageErrors}
              />
              <AgentMessengerRoleSelector
                role={role}
                setRole={setRole}
                disabled={isSending || isDraggedOver}
              />
              <Button
                type="submit"
                size="small"
                label={t('send')}
                preIcon={<SendIcon />}
                hideLabel
                color="secondary"
                disabled={(!text.trim() && images.length === 0) || isSending || hasImageErrors}
              />
            </HStack>
          </HStack>
        </VStack>
      </HStack>
      <input
        ref={hiddenFileInputRef}
        type="file"
        multiple
        accept={acceptedImageTypes.join(',')}
        className="hidden"
        onChange={handleFileInputChange}
      />
    </form>
  );
}
