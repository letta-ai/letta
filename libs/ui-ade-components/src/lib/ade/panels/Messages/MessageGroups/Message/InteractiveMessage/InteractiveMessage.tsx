import type {
  LettaMessageUnion,
  ToolReturnMessage,
} from '@letta-cloud/sdk-core';
import { InteractiveToolCallMessage } from './InteractiveToolCallMessage/InteractiveToolCallMessage';
import { InteractiveUserMessage } from './InteractiveUserMessage/InteractiveUserMessage';
import { InteractiveReasoningMessage } from './InteractiveReasoningMessage/InteractiveReasoningMessage';
import { InteractiveAgentMessage } from './InteractiveAgentMessage/InteractiveAgentMessage';
import { InteractiveHiddenReasoningMessage } from './InteractiveHiddenReasoningMessage/InteractiveHiddenReasoningMessage';
import { RequiresApprovalMessage } from './RequiresApprovalMessage/RequiresApprovalMessage';
import { ToolApprovedMessage } from './ToolApprovedMessage/ToolApprovedMessage';

interface InteractiveMessageProps {
  message: LettaMessageUnion;
  toolReturnMessage?: ToolReturnMessage;
}

export function InteractiveMessage(props: InteractiveMessageProps) {
  const { message, toolReturnMessage } = props;

  switch (message.message_type) {
    case 'tool_call_message': {
      if (message.tool_call.name === 'send_message') {
        return <InteractiveAgentMessage message={message} />;
      }

      return (
        <InteractiveToolCallMessage
          message={message}
          toolReturnMessage={toolReturnMessage}
        />
      );
    }
    case 'approval_response_message': {
      return <ToolApprovedMessage message={message} />;
    }

    case 'approval_request_message':
      return (
        <RequiresApprovalMessage
          message={message}
          toolReturnMessage={toolReturnMessage}
        />
      );
    case 'reasoning_message':
      return <InteractiveReasoningMessage message={message} />;
    case 'hidden_reasoning_message':
      return <InteractiveHiddenReasoningMessage message={message} />;
    case 'user_message':
      return <InteractiveUserMessage message={message} />;
    default:
      return null;
  }
}
