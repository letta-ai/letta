import type { ReasoningMessage } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo, useState } from 'react';
import { HStack, Typography, VStack } from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';
import type { MessageAdditionalMetadata } from '../types';
import { DateRender } from '../../shared/DateRender/DateRender';
import { EditMessageButton } from '../../shared/EditMessageButton/EditMessageButton';
import { AgentMessengerEditMessage } from '../../AgentMessengerEditMessage/AgentMessengerEditMessage';

interface ReasoningMessageComponentProps {
  message: ReasoningMessage;
  metadata: MessageAdditionalMetadata;
}

export function ReasoningMessageComponent(
  props: ReasoningMessageComponentProps,
) {
  const { message, metadata } = props;

  if (!message.reasoning) {
    return null;
  }

  const [opened, setOpened] = useState(false);

  const t = useTranslations(
    'AgentMessenger/messages/ReasoningMessageComponent',
  );
  const { formatNumber } = useFormatters();
  const [isEditOpened, setIsEditOpened] = useState(false);

  const duration = useMemo(() => {
    if (!metadata.hasNextMessageOrComplete) {
      return null;
    }

    if (!metadata.nextMessage) {
      return null;
    }

    if (!('date' in metadata.nextMessage)) {
      return null;
    }

    if (!message.date) {
      return null;
    }

    return (
      (new Date(metadata.nextMessage.date).getTime() -
        new Date(message.date).getTime()) /
      1000
    );
  }, [message, metadata]);

  const thoughtCopy = useMemo(() => {
    if (!metadata.hasNextMessageOrComplete) {
      return t('thinking');
    }

    if (!duration) {
      return t('unknownThought');
    }

    return t('thought', { duration: formatNumber(duration) });
  }, [duration, metadata, t, formatNumber]);

  return (
    <VStack>
      <button
        onClick={() => {
          setOpened(!opened);
        }}
      >
        <Typography color="muted" variant="body2">
          {thoughtCopy}
        </Typography>
      </button>
      {opened && (
        <>
          {!isEditOpened ? (
            <VStack>
              <Typography
                color="muted"
                variant="body2"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {message.reasoning}
              </Typography>
              <HStack>
                <DateRender message={message} />
                <EditMessageButton
                  onEdit={() => {
                    setIsEditOpened((v) => !v);
                  }}
                  isEditing={isEditOpened}
                />
              </HStack>
            </VStack>
          ) : (
            <AgentMessengerEditMessage
              message={message}
              onClose={() => {
                setIsEditOpened(false);
              }}
            />
          )}
        </>
      )}
    </VStack>
  );
}
