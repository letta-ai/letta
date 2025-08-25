import { useCallback, useMemo } from 'react';
import type { AgentSimulatorMessageGroupType } from '../../../AgentSimulator/types';
import {
  type LettaMessageUnion,
  type ListMessagesResponse,
} from '@letta-cloud/sdk-core';
import type { MessagesDisplayMode } from '../../types';

interface GroupedMessagesProps {
  messages: ListMessagesResponse;
  mode: MessagesDisplayMode;
}

export function useGroupedMessages(props: GroupedMessagesProps) {
  const { messages, mode } = props;


  const shouldRenderMessage = useCallback(
    function shouldRenderMessage(message: LettaMessageUnion) {
      switch (mode) {
        case 'interactive': {
          if (!message.message_type) {
            return false;
          }

          if (['system_message', 'tool_return_message'].includes(message.message_type )) {
            return false;
          }

          if (message.message_type === 'user_message') {

            // we should hide user_messages with `"type": "login" json (do not parse)
            if (typeof  message.content === 'string') {
              if (message.content?.includes('"type": "login"')) {
                return false;
              }

              // hides if type is system_alert
              if (message.content?.includes('"type": "system_alert"')) {
                return false;
              }
            }


            return true;
          }

          return true;
        }
        case 'debug':
          return true;
        case 'simple': {
          if (
            message.message_type === 'tool_call_message' &&
            message.tool_call.name === 'send_message'
          ) {
            return true;
          }

          return message.message_type === 'user_message';
        }
      }
    },
    [mode],
  );

  // Memoize filtered and sorted messages
  const processedMessages = useMemo(() => {
    if (messages.length === 0) {
      return [];
    }

    const messageExistingMap = new Set<string>();

    return messages
      .filter((message) => {
        if (!message.otid) {
          return true;
        }

        if (messageExistingMap.has(message.otid)) {
          return false;
        }

        messageExistingMap.add(message.otid);
        return true;
      })
      .filter((message) => shouldRenderMessage(message))
      .filter((message) => !!message)
      .sort((a, b) => {
        if (!a || !b) return 0;

        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        // if dates are the same, order by id
        if (dateA === dateB) {
          return a.id.localeCompare(b.id);
        }

        return dateA - dateB;
      });
  }, [messages, shouldRenderMessage]);

  // Memoize grouped messages with deep comparison
  return useMemo(() => {
    if (processedMessages.length === 0) {
      return [];
    }

    const groupedMessages: AgentSimulatorMessageGroupType[] = [];

    processedMessages.forEach((message, index) => {
      const lastGroup = groupedMessages[groupedMessages.length - 1];
      let name = 'Agent';

      if (message.message_type === 'user_message') {
        name = 'User';
      }

      if (message.message_type === 'system_message') {
        name = 'System';
      }

      if (index !== 0 && lastGroup && lastGroup.name === name) {
        lastGroup.messages.push(message);
      } else {
        groupedMessages.push({
          id: message.id || '1',
          name: name,
          messages: [message],
        });
      }
    });

    return groupedMessages;
  }, [processedMessages]);
}
