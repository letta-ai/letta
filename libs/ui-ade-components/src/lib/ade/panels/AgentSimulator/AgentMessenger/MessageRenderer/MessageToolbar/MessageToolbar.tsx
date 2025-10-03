import type { RunResponseMessage } from '../../../../../../hooks';
import {
  Button,
  ChevronDownIcon, ChevronUpIcon,
  DropdownMenu,
  DropdownMenuItem,
  HStack,
  VerticalDotsIcon
} from '@letta-cloud/ui-component-library';
import { FeedbackButtons } from '../../../../Messages/FeedbackButtons/FeedbackButtons';
import { useTranslations } from '@letta-cloud/translations';
import { useState } from 'react';
import { DateRender } from '../../shared/DateRender/DateRender';

interface MessageToolbarActionsProps {
  toggleDetails: () => void;
  setEditMessage: () => void;
  message: RunResponseMessage;
}

function MessageToolbarActions(props: MessageToolbarActionsProps) {
  const t = useTranslations('AgentMessenger/MessageToolbar.MessageToolbarActions');

  const { toggleDetails, message, setEditMessage } = props;

  return (
    <DropdownMenu
      triggerAsChild
      align="start"
      trigger={(
        <Button
          size="2xsmall"
          onClick={toggleDetails}
          hideLabel
          label={t('actions')}
          color="tertiary"
          preIcon={<VerticalDotsIcon color="muted" />}
        />
      )}
    >
      <DropdownMenuItem
         label={t('viewStepDetails')}
       />
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

  const t = useTranslations('AgentMessenger/MessageToolbar');

  return (
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
      <FeedbackButtons stepId="12" />
      <MessageToolbarActions
        message={message}
        toggleDetails={() => {
          setViewStepDetailsOpen(v => !v);
        }}
        setEditMessage={setEditMessage}
      />
      <DateRender message={message} />
    </HStack>
  )


}
