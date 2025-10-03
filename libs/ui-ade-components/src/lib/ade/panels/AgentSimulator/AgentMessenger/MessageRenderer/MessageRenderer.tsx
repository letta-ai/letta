import type { RunResponseMessage } from '../../../../../hooks';
import { DebugMessage } from '../messages/DebugMessage/DebugMessage';
import { UserMessageComponent } from '../messages/UserMessageComponent/UserMessageComponent';
import { AssistantMessageComponent } from '../messages/AssistantMessageComponent/AssistantMessageComponent';
import { ReasoningMessageComponent } from '../messages/ReasoningMessageComponent/ReasoningMessageComponent';
import { ToolCallMessageComponent } from '../messages/ToolCallMessageComponent/ToolCallMessageComponent';
import { ToolReturnMessageComponent } from '../messages/ToolReturnMessageComponent/ToolReturnMessageComponent';
import type { MessageAdditionalMetadata } from '../messages/types';
import { VStack } from '@letta-cloud/ui-component-library';
import { useMemo, useState } from 'react';
import { MessageToolbar } from './MessageToolbar/MessageToolbar';
import { AgentMessengerEditMessage } from '../AgentMessengerEditMessage/AgentMessengerEditMessage';
import { RunErrorMessageComponent } from '../messages/RunErrorMessageComponent/RunErrorMessageComponent';

interface MessageRendererProps {
  message: RunResponseMessage;
  isRunComplete?: boolean;
  metadata: MessageAdditionalMetadata;
}

function MessageRendererInner(props: MessageRendererProps) {
  const { message, metadata } = props;

  switch (message.message_type) {
    case 'user_message':
      return <UserMessageComponent message={message} metadata={metadata} />;
    // case 'system_message':
    //   return <SystemMessageComponent message={message} metadata={metadata} />;
    case 'assistant_message':
      return (
        <AssistantMessageComponent message={message} metadata={metadata} />
      );
    case 'reasoning_message':
      return (
        <ReasoningMessageComponent message={message} metadata={metadata} />
      );
    // case 'hidden_reasoning_message':
    //   return <HiddenReasoningMessageComponent message={message} metadata={metadata} />;
    case 'tool_call_message':
      return <ToolCallMessageComponent message={message} metadata={metadata} />;
    case 'tool_return_message':
      return (
        <ToolReturnMessageComponent message={message} metadata={metadata} />
      );
    case 'run_error_message':
      return <RunErrorMessageComponent message={message} />;
    // case 'approval_request_message':
    //   return <ApprovalRequestMessageComponent message={message} metadata={metadata} />;
    // case 'approval_response_message':
    //   return <ApprovalResponseMessageComponent message={message} metadata={metadata} />;
    case 'unknown':
      return <DebugMessage message={message} />;
    default:
      return <DebugMessage message={message} />;
  }
}

export function MessageRenderer(props: MessageRendererProps) {
  // const [showDetails, setShowDetails] = useState(false);
  const [editMessage, setEditMessage] = useState(false);

  const { message } = props;
  //
  const stepDetailMessage = useMemo(() => {
    // only return if message is a user_message, assistant_message, or the reasoning message if it is the last message and complete
    if (message.message_type === 'assistant_message') {
      return message;
    }

    if (message.message_type === 'tool_call_message') {
      return message;
    }

    if (
      message.message_type === 'reasoning_message' &&
      props.isRunComplete &&
      !props.metadata.nextMessage
    ) {
      return props.message;
    }

    return null;
  }, [message, props.message, props.isRunComplete, props.metadata.nextMessage]);

  if (editMessage && message.message_type === 'assistant_message') {
    return (
      <VStack fullWidth>
        <AgentMessengerEditMessage
          message={message}
          onClose={() => {
            setEditMessage(false);
          }}
        />
      </VStack>
    )
  }

  return (
    <VStack fullWidth>
      <MessageRendererInner {...props} />
      {stepDetailMessage && (
        <MessageToolbar
          setEditMessage={() => {
            setEditMessage(true);
          }}
          message={message}
        />
      )}
    </VStack>
  );
}
