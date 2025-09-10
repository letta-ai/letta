import type {
  LettaMessageUnion,
  ToolReturnMessage,
} from '@letta-cloud/sdk-core';
import { InteractiveMessage } from './InteractiveMessage/InteractiveMessage';
import { useMessagesContext } from '../../hooks/useMessagesContext/useMessagesContext';
import React, { useMemo, useState } from 'react';
import { HStack, JSONViewer, VStack } from '@letta-cloud/ui-component-library';
import { cn } from '@letta-cloud/ui-styles';
import { StepDetailBar } from './StepDetailBar/StepDetailBar';
import { EditMessage } from './EditMessage/EditMessage';
import { useMessageContext, MessageContextProvider } from './MessageContext';
import { useMessageGroupContext } from '../../hooks/useMessageGroupContext/useMessageGroupContext';

interface MessageProps {
  message: LettaMessageUnion;
  isLastMessage?: boolean;
  toolReturnMessage?: ToolReturnMessage;
}

function MessageInner(props: MessageProps) {
  const { message, toolReturnMessage } = props;
  const { displayMode } = useMessageGroupContext();

  switch (displayMode) {
    case 'simple':
      return <InteractiveMessage message={message} />;
    case 'interactive':
      return (
        <InteractiveMessage
          toolReturnMessage={toolReturnMessage}
          message={message}
        />
      );
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
}

interface MessageContentProps {
  message: LettaMessageUnion;
  toolReturnMessage?: ToolReturnMessage;
}

function MessageContent(props: MessageContentProps) {
  const { message, toolReturnMessage } = props;
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
      <MessageInner message={message} toolReturnMessage={toolReturnMessage} />
    </HStack>
  );
}

export function Message(props: MessageProps) {
  const { message, toolReturnMessage, isLastMessage } = props;
  const { disableInteractivity } = useMessagesContext();
  const { displayMode, baseMode } = useMessageGroupContext();

  const isNotSimple = useMemo(() => baseMode !== 'simple', [baseMode]);

  const canShowDetails = useMemo(() => {
    if (isLastMessage) {
      return true;
    }

    // if type is tool_call_message we can show details
    if (message.message_type === 'tool_call_message') {
      return true;
    }

    if (message.message_type === 'user_message') {
      return  true;
    }

    if (message.message_type === 'approval_request_message') {
      return true;
    }

    return false;
  }, [message, isLastMessage]);

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
          <MessageContent
            message={message}
            toolReturnMessage={toolReturnMessage}
          />
          {displayMode === 'debug' &&
            baseMode !== 'debug' &&
            toolReturnMessage && <MessageContent message={toolReturnMessage} />}
        </MessageContextProvider>
        {!disableInteractivity && isNotSimple && canShowDetails && (
          <StepDetailBar
            showDetails={showDetails}
            setShowDetails={setShowDetails}
            message={message}
          />
        )}
      </div>
    </VStack>
  );
}
