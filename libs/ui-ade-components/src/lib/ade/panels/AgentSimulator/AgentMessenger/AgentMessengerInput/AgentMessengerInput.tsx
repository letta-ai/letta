import { Button, HStack, SendIcon, VStack } from '@letta-cloud/ui-component-library';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { useTranslations } from '@letta-cloud/translations';
import type { SendMessageData } from '@letta-cloud/sdk-core';
import { useCurrentAgent } from '../../../../../hooks';

interface AgentMessengerInputProps {
  onSendMessage: (payload: SendMessageData) => void;
  isSending?: boolean;
}

export function AgentMessengerInput(props: AgentMessengerInputProps) {
  const { onSendMessage, isSending = false } = props;
  const searchParams = useSearchParams();
  const { id: agentId } = useCurrentAgent();

  const message = useMemo(() => {
    const messageParam = searchParams.get('message');
    return messageParam ? decodeURIComponent(messageParam) : '';
  }, [searchParams]);

  const [text, setText] = useState(message || '');

  const t = useTranslations('AgentMessenger/AgentMessengerInput');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    // Don't send if text is empty or already sending
    if (!text.trim() || isSending) {
      return;
    }

    // Send the message
    onSendMessage({
      agentId,
      requestBody: {
        messages: [
          {
            type: 'message',
            role: 'user',
            content: text.trim()
          }
        ]
      }
    });

    // Clear the input
    setText('');
  }, [text, onSendMessage, agentId, isSending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="contents" onSubmit={handleSubmit}>
      <HStack fullWidth className="px-5 mb-[32px]">
        <VStack padding="small" fullWidth className="shadow-sm rounded-md focus-within:outline-1" border>
          <TextareaAutosize
            className=" bg-transparent focus:outline-none text-sm resize-none"
            placeholder={t('placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxRows={5}
            minRows={2}
            disabled={isSending}
          />
          <HStack fullWidth justify="spaceBetween">
            <div />
            <HStack>
              <Button
                type="submit"
                size="small"
                preIcon={<SendIcon />}
                hideLabel
                color="secondary"
                disabled={!text.trim() || isSending}
              />
            </HStack>
          </HStack>
        </VStack>
      </HStack>
    </form>
  );
}
