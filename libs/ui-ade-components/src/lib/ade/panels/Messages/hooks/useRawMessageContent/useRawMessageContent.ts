import type { LettaMessageUnion } from '@letta-cloud/sdk-core';
import { parseMessageFromPartialJson } from '@letta-cloud/utils-client';

export function useRawMessageContent(message: LettaMessageUnion) {
  switch (message.message_type) {
    case 'tool_call_message':
      if (message.tool_call.name === 'send_message') {
        if (!message.tool_call.arguments) {
          return '';
        }

        return parseMessageFromPartialJson(message.tool_call.arguments);
      }

      return null;

    case 'reasoning_message':
      return message.reasoning || null;
    case 'user_message': {
      if (Array.isArray(message.content)) {
        return message.content
          .map((contentItem) => {
            if (contentItem.type === 'text') {
              return contentItem.text || '';
            }

            return '';
          })
          .join('');
      }

      return message.content || null;
    }

    default:
      return null;
  }
}
