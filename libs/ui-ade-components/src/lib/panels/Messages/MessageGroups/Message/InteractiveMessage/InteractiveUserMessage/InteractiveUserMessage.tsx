import type {
  ImageContent,
  LettaUserMessageContentUnion,
  UserMessage,
} from '@letta-cloud/sdk-core';
import {
  Dialog, HStack,
  ImagePreview,
  Markdown,
  VStack
} from '@letta-cloud/ui-component-library';
import React, { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { EditMessageButton } from '../../EditMessageButton/EditMessageButton';

function getImageSrc(imageContent: ImageContent): string | null {
  if (
    imageContent.source.type === 'base64' ||
    imageContent.source.type === 'letta'
  ) {
    const { media_type, data } = imageContent.source;
    if (!data || !media_type) return null;
    return `data:${media_type};base64,${data}`;
  }
  return null;
}

interface MessageImagePreviewProps {
  imageContent: ImageContent;
}

function MessageImagePreview({ imageContent }: MessageImagePreviewProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const src = useMemo(() => getImageSrc(imageContent), [imageContent]);
  const t = useTranslations('components/Messages');

  if (!src) {
    return null;
  }

  return (
    <>
      <ImagePreview
        src={src}
        alt={t('imageAltText')}
        thumbnailMaxWidth={200}
        thumbnailMaxHeight={150}
        onClick={() => {
          setIsDialogOpen(true);
        }}
        disabled={isDialogOpen}
      />
      <Dialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        size="large"
        confirmText={t('close')}
        hideCancel
        onConfirm={() => {
          setIsDialogOpen(false);
        }}
      >
        <img
          src={src}
          alt={t('imageAltText')}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
      </Dialog>
    </>
  );
}

interface InteractiveUserMessageProps {
  message: UserMessage;
}

export function InteractiveUserMessage({ message }: InteractiveUserMessageProps) {
  const content: LettaUserMessageContentUnion[] = useMemo(() => {
    if (typeof message.content === 'string') {
      return [{ type: 'text', text: message.content }];
    }

    return message.content.toSorted((a, b) => {
      // images first
      if (a.type === 'image' && b.type !== 'image') return -1;
      if (a.type !== 'image' && b.type === 'image') return 1;
      // then everything else
      return 0;
    })
  }, [message.content]);

  return (
    <HStack fullWidth align="start">
      <VStack fullWidth gap="medium">
        {content.map((item, idx) => {
          switch (item.type) {
            case 'text':
              return (
                <Markdown
                  key={idx}
                  text={item.text}
                />
              );
            case 'image':
              return (
                <MessageImagePreview
                  key={idx}
                  imageContent={item as ImageContent}
                />
              );
            default:
              return null;
          }
        })}
      </VStack>
      <EditMessageButton />
    </HStack>
  );
}
