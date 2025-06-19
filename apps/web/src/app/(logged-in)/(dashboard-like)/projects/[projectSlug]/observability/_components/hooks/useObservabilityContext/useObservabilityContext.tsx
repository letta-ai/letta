'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import { useSessionStorage } from '@mantine/hooks';
import type { OptionType } from '@letta-cloud/ui-component-library';
import { useEmptyBaseTemplateValue } from '../useEmptyBaseTemplateValue/useEmptyBaseTemplateValue';

export type ChartType = 'activity' | 'all' | 'errors' | 'performance';

interface ObservabilityContextType {
  startDate: string;
  endDate: string;
  setDateRange: (startDate: Date, endDate: Date) => void;
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  baseTemplateId: OptionType;
  setBaseTemplateId: (templateId: OptionType) => void;
}

const ObservabilityContext = createContext<ObservabilityContextType>({
  startDate: new Date().toISOString(),
  chartType: 'all',
  endDate: new Date().toISOString(),
  setDateRange: () => {
    return;
  },
  setChartType: () => {
    return;
  },
  setBaseTemplateId: () => {
    return;
  },
  baseTemplateId: {
    label: '',
    value: '',
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

  const emptyValue = useEmptyBaseTemplateValue();
  const [baseTemplateId, setBaseTemplateId] = useState<OptionType>(emptyValue);

  const [chartType, setChartType] = useSessionStorage<ChartType>({
    key: 'observability-chart-type',
    defaultValue: 'all',
  });

  const value = useMemo(
    () => ({
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      setBaseTemplateId,
      baseTemplateId,
      chartType,
      setDateRange: (startDate: Date, endDate: Date) => {
        setStartTime(startOfDay(startDate));
        setEndDate(endOfDay(endDate));
      },
      setChartType: (type: ChartType) => {
        setChartType(type);
      },
    }),
    [startDate, endDate, baseTemplateId, chartType, setChartType],
  );

  return (
    <ObservabilityContext.Provider value={value}>
      {children}
    </ObservabilityContext.Provider>
  );
}
