import type { Dispatch, SetStateAction } from 'react';
import React from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  ChatBubbleIcon,
  ChatIcon,
  CodeIcon,
  RawToggleGroup,
} from '@letta-cloud/ui-component-library';
import type { MessagesDisplayMode } from '../../Messages/types';

interface ChatroomContextType {
  renderMode: MessagesDisplayMode;
  setRenderMode: Dispatch<SetStateAction<ChatroomContextType['renderMode']>>;
}

export const ChatroomContext = React.createContext<ChatroomContextType>({
  renderMode: 'interactive',
  setRenderMode: () => {
    return;
  },
});

export function ControlChatroomRenderMode() {
  const t = useTranslations('ADE/AgentSimulator');
  const { renderMode, setRenderMode } = React.useContext(ChatroomContext);

  return (
    <RawToggleGroup
      size="xsmall"
      onValueChange={(value) => {
        if (value) {
          setRenderMode(value as MessagesDisplayMode);
        }
      }}
      value={renderMode}
      label={t('setChatroomRenderMode.label')}
      hideLabel
      items={[
        {
          icon: <CodeIcon />,
          label: t('setChatroomRenderMode.options.debug'),
          value: 'debug',
          hideLabel: true,
        },
        {
          icon: <ChatIcon />,
          label: t('setChatroomRenderMode.options.interactive'),
          value: 'interactive',
          hideLabel: true,
        },
        {
          icon: <ChatBubbleIcon />,
          label: t('setChatroomRenderMode.options.simple'),
          value: 'simple',
          hideLabel: true,
        },
      ]}
    />
  );
}
