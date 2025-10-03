import type { RunResponseMessage } from '../../../../../../hooks';
import {
  Button,
  ChevronDownIcon, ChevronUpIcon,
  DropdownMenu,
  DropdownMenuItem,
  HStack, useCopyToClipboard,
  VerticalDotsIcon, VStack
} from '@letta-cloud/ui-component-library';
import { FeedbackButtons } from '../../../../Messages/FeedbackButtons/FeedbackButtons';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo, useState } from 'react';
import { DateRender } from '../../shared/DateRender/DateRender';
import { MessageToolbarDetails } from './MessageToolbarDetails/MessageToolbarDetails';
import { useRawMessageContent } from '../../../../Messages/hooks/useRawMessageContent/useRawMessageContent';

interface MessageToolbarActionsProps {
  toggleDetails: () => void;
  setEditMessage: () => void;
  message: RunResponseMessage;
}

function MessageToolbarActions(props: MessageToolbarActionsProps) {
  const t = useTranslations('AgentMessenger/MessageToolbar.MessageToolbarActions');

  const { toggleDetails, message, setEditMessage } = props;

  const copiableMessage = useMemo(() => {
    // only assistant, user and reasoning_message
    if (message.message_type === 'assistant_message' || message.message_type === 'user_message' || message.message_type === 'reasoning_message') {
      return message;
    }

    return null;
  }, [message]);

  const raw = useRawMessageContent(copiableMessage || undefined);

  const { copyToClipboard } = useCopyToClipboard({
    textToCopy: raw || ''
  })

  return (
    <DropdownMenu
      triggerAsChild
      align="start"
      trigger={(
        <Button
          size="2xsmall"
          hideLabel
          label={t('actions')}
          color="tertiary"
          preIcon={<VerticalDotsIcon color="muted" />}
        />
      )}
    >
      <DropdownMenuItem
        onClick={toggleDetails}
        label={t('viewStepDetails')}
       />
      {raw && (
        <DropdownMenuItem
          label={t('copyMessage')}
          onSelect={() => {
            copyToClipboard();
          }}
        />
      )}

      {message.message_type === 'assistant_message' && (
        <DropdownMenuItem
          label={t('editMessage')}
          onSelect={() => {
            setEditMessage();
          }}
        />
      )}

    </DropdownMenu>
  )
}




interface MessageToolbarProps {
  message: RunResponseMessage;
  setEditMessage: () => void;
}

export function MessageToolbar(props: MessageToolbarProps) {
  const { message, setEditMessage } = props;

  const [viewStepDetailsOpen, setViewStepDetailsOpen] = useState(false);

  const stepId = useMemo(() => {
    if ('step_id' in message) {
      return message.step_id;
    }
    return undefined;
  }, [message]);

  const runId = useMemo(() => {
    if ('run_id' in message) {
      return message.run_id;
    }
    return undefined;
  }, [message]);

  const t = useTranslations('AgentMessenger/MessageToolbar');

  return (
    <VStack>
      <HStack align="center">
        <Button
          size="2xsmall"
          onClick={() => {
            setViewStepDetailsOpen(v => !v);
          }}
          hideLabel
          label={t('viewStepDetails')}
          color="tertiary"
          preIcon={viewStepDetailsOpen ? <ChevronUpIcon color="muted" /> : <ChevronDownIcon color="muted" />}
        />
        <FeedbackButtons stepId={stepId || ''} />
        <MessageToolbarActions
          message={message}
          toggleDetails={() => {
            setViewStepDetailsOpen(v => !v);
          }}
          setEditMessage={setEditMessage}
        />
        <DateRender message={message} />
      </HStack>
      {viewStepDetailsOpen && (
        <MessageToolbarDetails runId={runId || ''} stepId={stepId || ''} />
      )}
    </VStack>
  )


}
