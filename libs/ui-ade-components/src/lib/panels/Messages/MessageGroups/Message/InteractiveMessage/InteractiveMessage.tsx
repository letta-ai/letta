import type { LettaMessageUnion } from '@letta-cloud/sdk-core';
import { InteractiveToolCallMessage } from './InteractiveToolCallMessage/InteractiveToolCallMessage';
import { InteractiveUserMessage } from './InteractiveUserMessage/InteractiveUserMessage';
import { InteractiveReasoningMessage } from './InteractiveReasoningMessage/InteractiveReasoningMessage';
import { InteractiveAgentMessage } from './InteractiveAgentMessage/InteractiveAgentMessage';

interface InteractiveMessageProps {
  message: LettaMessageUnion
}

export function InteractiveMessage(props: InteractiveMessageProps) {
  const { message } = props;

  switch (message.message_type) {
    case 'tool_call_message': {
      if (message.tool_call.name === 'send_message') {
        return <InteractiveAgentMessage message={message} />
      }

      return <InteractiveToolCallMessage message={message} />
    }
    case 'reasoning_message':
      return <InteractiveReasoningMessage message={message} />
    case 'user_message':
      return <InteractiveUserMessage message={message} />
    default:
      return null;
  }
}
