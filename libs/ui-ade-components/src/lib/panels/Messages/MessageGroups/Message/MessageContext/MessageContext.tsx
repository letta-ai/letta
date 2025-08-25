import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface MessageContextType {
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}

const MessageContext = createContext<MessageContextType | null>(null);

export function useMessageContext(): MessageContextType {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessageContext must be used within a MessageContextProvider');
  }
  return context;
}

interface MessageContextProviderProps {
  children: ReactNode;
}

export function MessageContextProvider({ children }: MessageContextProviderProps) {
  const [isEditing, setIsEditing] = useState(false);

  const value: MessageContextType = {
    isEditing,
    setIsEditing,
  };

  return (
    <MessageContext.Provider value={value}>
      {children}
    </MessageContext.Provider>
  );
}
