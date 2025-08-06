import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormatters } from '@letta-cloud/utils-client';
import { useCurrentUser } from '$web/client/hooks';
import type { EChartsOption, SeriesOption } from 'echarts';
import { addDays, addMinutes, addHours } from 'date-fns';
import { useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';

interface BaseType {
  date: string; // Assuming the date is in YYYY-MM-DD format
}

interface UseSeriesDataOptions<T extends BaseType> {
  startDate: string;
  endDate: string;
  formatter?: (value: number) => string;
  seriesData: Array<{
    data?: T[] | null;
    defaultValue?: number;
    nameGetterFn?: (data: T) => string;
    getterFn: (data: T) => number | null;
  }>;
}

export function useObservabilitySeriesData<T extends BaseType>(
  options: UseSeriesDataOptions<T>,
): Partial<EChartsOption> {
  const { startDate, endDate, seriesData, formatter } = options;
  const { granularity } = useObservabilityContext();

  const { formatDate } = useFormatters();

  // Helper functions to simulate ClickHouse time bucketing
  const simulateClickHouseTimeBucketing = useCallback(
    (date: Date): Date => {
      const d = new Date(date);

      switch (granularity.intervalMinutes) {
        case 5: // toStartOfFiveMinutes
          d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
          return d;
        case 20: // toStartOfInterval(Timestamp, INTERVAL 20 MINUTE)
          d.setMinutes(Math.floor(d.getMinutes() / 20) * 20, 0, 0);
          return d;
        case 60: // toStartOfHour
          d.setMinutes(0, 0, 0);
          return d;
        case 1440: // toDate (daily)
          d.setHours(0, 0, 0, 0);
          return d;
        default:
          // Generic interval rounding
          d.setMinutes(
            Math.floor(d.getMinutes() / granularity.intervalMinutes) *
              granularity.intervalMinutes,
            0,
            0,
          );
          return d;
      }
    },
    [granularity.intervalMinutes],
  );

  const { labels: xAxis } = useMemo(() => {
    // Generate x-axis labels that match ClickHouse time bucketing exactly
    const labels = [];
    const dates = [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    const intervalMinutes = granularity.intervalMinutes;

    // Start from the first ClickHouse interval boundary at or before start time
    let current = simulateClickHouseTimeBucketing(start);

    while (current < end) {
      const formatOptions =
        granularity.displayFormat === 'HH:mm'
          ? { hour: '2-digit' as const, minute: '2-digit' as const }
          : { month: 'short' as const, day: 'numeric' as const };

      labels.push(formatDate(current, formatOptions));
      dates.push(new Date(current));

      // Increment based on interval
      if (intervalMinutes >= 1440) {
        // Daily intervals
        current = addDays(current, 1);
      } else if (intervalMinutes >= 60) {
        // Hourly intervals
        current = addHours(current, intervalMinutes / 60);
      } else {
        // Minute intervals
        current = addMinutes(current, intervalMinutes);
      }
    }

    return {
      labels: labels,
      dates: dates,
    };
  }, [
    startDate,
    endDate,
    formatDate,
    granularity,
    simulateClickHouseTimeBucketing,
  ]);

  interface GetSeriesDataParams<T extends BaseType> {
    data: UseSeriesDataOptions<T>['seriesData'][number]['data'] | null;
    getterFn: UseSeriesDataOptions<T>['seriesData'][number]['getterFn'];
    nameGetterFn?: UseSeriesDataOptions<T>['seriesData'][number]['nameGetterFn'];
    defaultValue?: UseSeriesDataOptions<T>['seriesData'][number]['defaultValue'];
  }

  const getSeriesData = useCallback(
    function getSeriesData<T extends BaseType>({
      data,
      getterFn,
      nameGetterFn,
      defaultValue,
    }: GetSeriesDataParams<T>) {
      if (!data) return [];

      const mappedData = data.reduce(
        (acc, item) => {
          const value = getterFn(item);

          // Parse the date from the item (backend returns UTC timestamps in format "YYYY-MM-DD HH:mm:ss")
          // Force UTC interpretation by appending 'Z'
          const itemDate = new Date(item.date + 'Z');

          // Apply same ClickHouse bucketing simulation to ensure exact matching
          const bucketedDate = simulateClickHouseTimeBucketing(itemDate);

          // Format based on granularity (will convert UTC to local time)
          const formatOptions =
            granularity.displayFormat === 'HH:mm'
              ? { hour: '2-digit' as const, minute: '2-digit' as const }
              : { month: 'short' as const, day: 'numeric' as const };

          const dateKey = formatDate(bucketedDate, formatOptions);

          acc[dateKey] = {
            value: typeof value === 'number' ? value : undefined,
            name: nameGetterFn ? nameGetterFn(item) : undefined,
          };

          return acc;
        },
        {} as Record<string, { name?: string; value: number | undefined }>,
      );

      // Map the data to the format required by the chart
      return xAxis.map((date) => {
        const dateKey = date; // Assuming date is in YYYY-MM-DD format
        const item = mappedData[dateKey];

        if (typeof item?.value === 'undefined') {
          if (typeof defaultValue === 'number') {
            return { value: defaultValue, name: item?.name };
          }

          return { value: null, name: item?.name };
        }

        return item;
      });
    },
    [
      xAxis,
      simulateClickHouseTimeBucketing,
      granularity.displayFormat,
      formatDate,
    ],
  );

  const series: SeriesOption[] = useMemo(() => {
    return seriesData.map((item) => {
      return {
        type: 'line',
        connectNulls: true,
        symbol: 'circle',
        data: getSeriesData({
          data: item.data,
          getterFn: item.getterFn,
          nameGetterFn: item.nameGetterFn,
          defaultValue: item.defaultValue,
        }),
      };
    });
  }, [getSeriesData, seriesData]);
  const { formatShorthandNumber } = useFormatters();

  const [styles, setStyles] = useState(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return getComputedStyle(document.documentElement);
  });
  const user = useCurrentUser();

  useEffect(() => {
    if (user?.theme) {
      const rootStyles = getComputedStyle(document.documentElement);
      setStyles(rootStyles);
    }
  }, [user?.theme]);

  return useMemo(
    () => ({
      xAxis: {
        data: xAxis,
        alignTicks: true,
        lineStyle: {
          color: `hsl(${styles?.getPropertyValue('--border')})`,
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: `hsl(${styles?.getPropertyValue('--border')})`,
          },
        },
        axisLine: {
          show: false,
        },
        minorTick: {
          show: false,
        },
        axisLabel: {
          fontFamily: styles?.getPropertyValue('--font-mono'),
          fontSize: styles?.getPropertyValue('--font-size-xs'),
        },
      },
      yAxis: {
        alignTicks: true,
        splitLine: {
          show: true,
          lineStyle: {
            color: `hsl(${styles?.getPropertyValue('--border')})`,
          },
        },
        axisLine: {
          show: false,
        },
        minorTick: {
          show: false,
        },
        axisLabel: {
          fontFamily: styles?.getPropertyValue('--font-mono'),
          fontSize: styles?.getPropertyValue('--font-size-xs'),
          inside: false,
          formatter: function (value: number) {
            if (formatter) {
              return formatter(value);
            }

            if (value > 1) {
              return formatShorthandNumber(value, 0);
            }

            return value.toString();
          },
        },
      },
      grid: {
        borderColor: `hsl(${styles?.getPropertyValue('--border')})`,
        show: true,
        left: 40,
        right: 0,
        bottom: 30,
        top: 15,
      },
      series,
    }),
    [xAxis, styles, series, formatter, formatShorthandNumber],
  );
}
