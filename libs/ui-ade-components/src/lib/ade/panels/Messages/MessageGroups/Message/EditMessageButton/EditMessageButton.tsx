import { Button, EditIcon } from '@letta-cloud/ui-component-library';
import React from 'react';
import { useMessagesContext } from '../../../hooks/useMessagesContext/useMessagesContext';
import { useMessageContext } from '../MessageContext';
import { useTranslations } from '@letta-cloud/translations';
import { useMessageGroupContext } from '../../../hooks/useMessageGroupContext/useMessageGroupContext';


export function EditMessageButton() {

  const { disableInteractivity } = useMessagesContext();
  const { displayMode } = useMessageGroupContext()
  const { isEditing, setIsEditing } = useMessageContext();

  const t = useTranslations('components/Messages');

  if (displayMode === 'interactive' && !disableInteractivity) {
    return (
      <Button
        preIcon={<EditIcon size="auto" />}
        onClick={() => {
          setIsEditing(!isEditing);
        }}
        size="3xsmall"
        hideLabel
        square
        active={isEditing}
        _use_rarely_className="w-4 min-h-4 messages-step-editor text-muted hover:text-brand hover:bg-transparent"
        label={isEditing ? t('edit.stop') : t('edit.start')}
        color="tertiary"
      />
    )
  }

  return null
}
