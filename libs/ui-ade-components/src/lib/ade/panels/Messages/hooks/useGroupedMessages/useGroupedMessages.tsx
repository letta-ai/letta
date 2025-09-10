import { useMemo } from 'react';
import type { AgentSimulatorMessageGroupType } from '../../../AgentSimulator/types';
import {
  type ListMessagesResponse,
} from '@letta-cloud/sdk-core';

interface GroupedMessagesProps {
  messages: ListMessagesResponse;
}


export function useGroupedMessages(props: GroupedMessagesProps) {
  const { messages } = props;




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

        if (messageExistingMap.has(`${message.otid}_${message.message_type}`)) {
          return false;
        }

        messageExistingMap.add(`${message.otid}_${message.message_type}`);
        return true;
      })
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
  }, [messages]);


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
