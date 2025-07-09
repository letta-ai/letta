import { createContext, useContext, useState } from 'react';

export type MemoryType = 'simulated' | 'templated';

const VisibleMemoryTypeContext = createContext<UseVisibleMemoryTypeContext>({
  visibleMemoryType: 'simulated',
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
}: {
  children: React.ReactNode;
}) {
  const [visibleMemoryType, setVisibleMemoryType] =
    useState<MemoryType>('templated');

  return (
    <VisibleMemoryTypeContext.Provider
      value={{ visibleMemoryType, setVisibleMemoryType }}
    >
      {children}
    </VisibleMemoryTypeContext.Provider>
  );
}
