import { createContext, useContext, useState } from 'react';

export type MemoryType = 'agent' | 'templated';

const VisibleMemoryTypeContext = createContext<UseVisibleMemoryTypeContext>({
  visibleMemoryType: 'agent',
  setVisibleMemoryType: () => {
    return;
  },
});

interface UseVisibleMemoryTypeContext {
  visibleMemoryType: MemoryType;
  setVisibleMemoryType: (type: MemoryType) => void;
}

export function useVisibleMemoryTypeContext() {
  return useContext(VisibleMemoryTypeContext);
}

export function VisibleMemoryTypeProvider({
  children,
  defaultVisibleMemoryType = 'agent',
}: {
  children: React.ReactNode;
  defaultVisibleMemoryType?: MemoryType;
}) {

  const [visibleMemoryType, setVisibleMemoryType] =
    useState<MemoryType>(defaultVisibleMemoryType || 'agent');

  return (
    <VisibleMemoryTypeContext.Provider
      value={{ visibleMemoryType, setVisibleMemoryType }}
    >
      {children}
    </VisibleMemoryTypeContext.Provider>
  );
}
