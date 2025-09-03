import React, { createContext, useContext, useMemo, memo } from 'react';

interface MessagesContextType {
  disableInteractivity: boolean;
}

const MessagesContext = createContext<MessagesContextType | undefined>(
  undefined,
);

export const useMessagesContext = () => {
  const context = useContext(MessagesContext);

  return {
    disableInteractivity: context?.disableInteractivity ?? false,
  };
};

interface MessagesProviderProps {
  children: React.ReactNode;
  disableInteractivity: boolean;
}

export const MessagesProvider: React.FC<MessagesProviderProps> = memo(
  ({ children, disableInteractivity }) => {
    const value = useMemo(
      () => ({
        disableInteractivity,
      }),
      [disableInteractivity],
    );

    return (
      <MessagesContext.Provider value={value}>
        {children}
      </MessagesContext.Provider>
    );
  },
);
