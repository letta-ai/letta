'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import { endOfDay, startOfDay, subDays } from 'date-fns';

interface ObservabilityContextType {
  startDate: string;
  endDate: string;
  setDateRange: (startDate: Date, endDate: Date) => void;
}

const ObservabilityContext = createContext<ObservabilityContextType>({
  startDate: new Date().toISOString(),
  endDate: new Date().toISOString(),
  setDateRange: () => {
    return;
  },
});

export function useObservabilityContext() {
  return useContext(ObservabilityContext);
}

interface ObservabilityProviderProps {
  children: React.ReactNode;
}

export function ObservabilityProvider({
  children,
}: ObservabilityProviderProps) {
  const [endDate, setEndDate] = useState(endOfDay(new Date()));
  const [startDate, setStartTime] = useState(
    startOfDay(subDays(new Date(), 30)),
  );

  const value = useMemo(
    () => ({
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      setDateRange: (startDate: Date, endDate: Date) => {
        setStartTime(startOfDay(startDate));
        setEndDate(endOfDay(endDate));
      },
    }),
    [startDate, endDate],
  );

  return (
    <ObservabilityContext.Provider value={value}>
      {children}
    </ObservabilityContext.Provider>
  );
}
