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
import type { MessageAdditionalMetadata } from '../types';
import './UserMessageComponent.scss';
import { DateRender } from '../../shared/DateRender/DateRender';
import { AgentMessengerEditMessage } from '../../AgentMessengerEditMessage/AgentMessengerEditMessage';
import { EditMessageButton } from '../../shared/EditMessageButton/EditMessageButton';

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

interface UserMessageComponentProps {
  message: UserMessage;
  metadata: MessageAdditionalMetadata;
}

export function UserMessageComponent({ message }: UserMessageComponentProps) {
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

  const [isEditOpened, setIsEditOpened] = useState(false);

  if (isEditOpened) {
    return (
      <AgentMessengerEditMessage
        message={message}
        onClose={() => {
          setIsEditOpened(false);
        }}
      />
    )
  }

  return (
    <VStack justify="end"  fullWidth align="end" className="user-message-container">
      <HStack justify="end"  fullWidth align="end">
        <VStack color="background-grey2" padding="small" className="rounded-md" gap="medium">
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

      </HStack>
      <HStack className="user-message-toolbar">
        <DateRender message={message} />
        <EditMessageButton
          onEdit={() => {
            setIsEditOpened((v) => !v);
          }}
          isEditing={isEditOpened}
        />
      </HStack>
    </VStack>
  );
}
