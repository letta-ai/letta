import React, { createContext, useContext, useMemo, memo } from 'react';
import type { MessagesDisplayMode } from '../../types';

interface MessagesContextType {
  disableInteractivity: boolean;
  mode: MessagesDisplayMode;
}

const MessagesContext = createContext<MessagesContextType | undefined>(
  undefined,
);

export const useMessagesContext = () => {
  const context = useContext(MessagesContext);

  return {
    disableInteractivity: context?.disableInteractivity ?? false,
    mode: context?.mode ?? 'interactive',
  };
};

interface MessagesProviderProps {
  children: React.ReactNode;
  disableInteractivity: boolean;
  mode: MessagesDisplayMode;
}

export const MessagesProvider: React.FC<MessagesProviderProps> = memo(
  ({ children, disableInteractivity, mode }) => {
    const value = useMemo(
      () => ({
        disableInteractivity,
        mode,
      }),
      [disableInteractivity, mode],
    );

    return (
      <MessagesContext.Provider value={value}>
        {children}
      </MessagesContext.Provider>
    );
  },
);
