import type { LettaMessageUnion } from '@letta-cloud/sdk-core';
import { InteractiveMessage } from './InteractiveMessage/InteractiveMessage';
import { useMessagesContext } from '../../hooks/useMessagesContext/useMessagesContext';
import React, { memo, useMemo, useState } from 'react';
import {
  HStack,
  JSONViewer,
  VStack,
} from '@letta-cloud/ui-component-library';
import { cn } from '@letta-cloud/ui-styles';
import { StepDetailBar } from './StepDetailBar/StepDetailBar';
import { EditMessage } from './EditMessage/EditMessage';
import { deepEqual } from 'fast-equals';
import { useMessageContext, MessageContextProvider } from './MessageContext';

interface MessageProps {
  message: LettaMessageUnion;
}

const MessageInner = memo(
  function MessageInner(props: MessageProps) {
    const { message } = props;
    const { mode } = useMessagesContext();

    switch (mode) {
      case 'simple':
        return <InteractiveMessage message={message} />;
      case 'interactive':
        return <InteractiveMessage message={message} />;
      case 'debug':
        return (
          <VStack
            overflowX="auto"
            fullWidth
            color="background-grey"
            border
            padding="xsmall"
          >
            <JSONViewer noWrap data={message} />
          </VStack>
        );

      default:
        return null;
    }
  },
  (prevProps, nextProps) => {
    return deepEqual(prevProps.message, nextProps.message);
  },
);

interface MessageContentProps {
  message: LettaMessageUnion;
}

const MessageContent = memo(
  function MessageContent(props: MessageContentProps) {
    const { message } = props;
    const { isEditing, setIsEditing } = useMessageContext();

    if (isEditing) {
      return (
        <EditMessage
          onClose={() => {
            setIsEditing(false);
          }}
          onSuccess={() => {
            setIsEditing(false);
          }}
          message={message}
        />
      );
    }

    // Default handling for other message types
    return (
      <HStack justify="spaceBetween" align="start">
        <MessageInner message={message} />

      </HStack>
    );
  },
  (prevProps, nextProps) => {
    return deepEqual(prevProps.message, nextProps.message);
  },
);

export const Message = memo(
  function Message(props: MessageProps) {
    const { message } = props;
    const { disableInteractivity, mode } = useMessagesContext();

    const isInteractiveMode = useMemo(() => mode === 'interactive', [mode]);

    const [showDetails, setShowDetails] = useState(false);

    return (
      <VStack
        id={`message_${message.id || 'unk'}_${message.message_type}`}
        gap={false}
        fullWidth
      >
        <div
          className={cn(
            'w-full rounded-t-md messages-step border border-transparent',
            showDetails
              ? 'bg-background-grey message-step-selected border-border border-t border-x p-2.5  pb-1'
              : '',
          )}
        >
          <MessageContextProvider>
            <MessageContent message={message} />
          </MessageContextProvider>
          {!disableInteractivity && isInteractiveMode && (
            <StepDetailBar
              showDetails={showDetails}
              setShowDetails={setShowDetails}
              message={message}
            />
          )}
        </div>
      </VStack>
    );
  },
  (prevProps, nextProps) => {
    return deepEqual(prevProps.message, nextProps.message);
  },
);
