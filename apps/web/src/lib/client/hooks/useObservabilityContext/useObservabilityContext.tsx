'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import { endOfDay, startOfDay } from 'date-fns';
import { useSessionStorage } from '@mantine/hooks';
import type { OptionType } from '@letta-cloud/ui-component-library';
import { useEmptyBaseTemplateValue } from '../../../../app/(logged-in)/(dashboard-like)/projects/[projectSlug]/observability/_components/hooks/useEmptyBaseTemplateValue/useEmptyBaseTemplateValue';
import type { TimeRange, TimeGranularity } from './timeConfig';
import { getTimeConfig, computeStartEndDates } from './timeConfig';

export type ChartType = 'activity' | 'all' | 'errors' | 'performance';

const DEFAULT_TIME_RANGE: TimeRange = '4h';

interface ObservabilityContextType {
  startDate: string;
  endDate: string;
  timeRange: TimeRange;
  granularity: TimeGranularity;
  setTimeRange: (timeRange: TimeRange) => void;
  setDateRange: (startDate: Date, endDate: Date) => void;
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  noTemplateFilter: boolean;
  baseTemplateId: OptionType;
  setBaseTemplateId: (templateId: OptionType) => void;
}

const ObservabilityContext = createContext<ObservabilityContextType>({
  startDate: new Date().toISOString(),
  endDate: new Date().toISOString(),
  timeRange: DEFAULT_TIME_RANGE,
  granularity: getTimeConfig(DEFAULT_TIME_RANGE),
  noTemplateFilter: false,
  chartType: 'all',
  setTimeRange: () => {
    return;
  },
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
  baseTemplate?: OptionType;
  noTemplateFilter?: boolean;
}

export function ObservabilityProvider({
  children,
  baseTemplate,
  noTemplateFilter,
}: ObservabilityProviderProps) {
  const [timeRange, setTimeRangeState] = useSessionStorage<TimeRange>({
    key: 'observability-time-range',
    defaultValue: DEFAULT_TIME_RANGE,
  });

  // Compute dates based on time range
  const { startDate: computedStartDate, endDate: computedEndDate } =
    computeStartEndDates(timeRange);
  const [customStartDate, setCustomStartDate] = useState(computedStartDate);
  const [customEndDate, setCustomEndDate] = useState(computedEndDate);

  // Use custom dates if timeRange is 'custom', otherwise use computed dates
  const startDate =
    timeRange === 'custom' ? customStartDate : computedStartDate;
  const endDate = timeRange === 'custom' ? customEndDate : computedEndDate;

  const granularity = useMemo(() => getTimeConfig(timeRange), [timeRange]);

  const emptyValue = useEmptyBaseTemplateValue();
  const [baseTemplateId, setBaseTemplateId] = useState<OptionType>(
    baseTemplate || emptyValue,
  );

  const [chartType, setChartType] = useSessionStorage<ChartType>({
    key: 'observability-chart-type',
    defaultValue: 'all',
  });

  const value = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timeRange,
      granularity,
      setTimeRange: (newTimeRange: TimeRange) => {
        setTimeRangeState(newTimeRange);
        if (newTimeRange !== 'custom') {
          // Reset custom dates when switching away from custom
          const { startDate: newStart, endDate: newEnd } =
            computeStartEndDates(newTimeRange);
          setCustomStartDate(newStart);
          setCustomEndDate(newEnd);
        }
      },
      setDateRange: (startDate: Date, endDate: Date) => {
        setCustomStartDate(startOfDay(startDate));
        setCustomEndDate(endOfDay(endDate));
        setTimeRangeState('custom');
      },
      setBaseTemplateId,
      noTemplateFilter: noTemplateFilter || false,
      baseTemplateId,
      chartType,
      setChartType: (type: ChartType) => {
        setChartType(type);
      },
    }),
    [
      startDate,
      endDate,
      timeRange,
      granularity,
      noTemplateFilter,
      baseTemplateId,
      chartType,
      setChartType,
      setTimeRangeState,
    ],
  );

  return (
    <ObservabilityContext.Provider value={value}>
      {children}
    </ObservabilityContext.Provider>
  );
}
