import type { MessagesDisplayMode } from '../../types';
import React, { createContext, useContext, useState } from 'react';

interface MessageGroupContext {
  setDisplayMode: (mode: MessagesDisplayMode) => void;
  displayMode: MessagesDisplayMode;
  baseMode: MessagesDisplayMode;
}

const MessageGroupContext = createContext<MessageGroupContext>(
  {
    setDisplayMode: () => {
    },
    displayMode: 'interactive',
    baseMode: 'interactive',
  });

interface MessagesGroupsProps {
  children: React.ReactNode;
  mode: MessagesDisplayMode;
}

export const MessageGroupContextProvider: React.FC<MessagesGroupsProps> = (
  props
) => {
  const { children, mode } = props;
  const [displayMode, setDisplayMode] = useState<MessagesDisplayMode>(mode);

  return (
    <MessageGroupContext.Provider
      value={{
        displayMode,
        setDisplayMode,
        baseMode: mode,
      }}
    >
      {children}
    </MessageGroupContext.Provider>
  );
};

export function useMessageGroupContext() {
  return useContext(MessageGroupContext)
}
