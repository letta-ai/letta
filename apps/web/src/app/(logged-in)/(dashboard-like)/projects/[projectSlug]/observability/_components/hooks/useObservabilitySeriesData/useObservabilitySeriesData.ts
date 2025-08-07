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

  // Helper functions to simulate ClickHouse time bucketing in UTC
  const simulateClickHouseTimeBucketing = useCallback(
    (date: Date): Date => {
      const d = new Date(date);

      switch (granularity.intervalMinutes) {
        case 5: // toStartOfFiveMinutes
          d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 5) * 5, 0, 0);
          return d;
        case 20: // toStartOfInterval(Timestamp, INTERVAL 20 MINUTE)
          d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 20) * 20, 0, 0);
          return d;
        case 60: // toStartOfHour
          d.setUTCMinutes(0, 0, 0);
          return d;
        case 1440: // toDate (daily)
          d.setUTCHours(0, 0, 0, 0);
          return d;
        default:
          // Generic interval rounding
          d.setUTCMinutes(
            Math.floor(d.getUTCMinutes() / granularity.intervalMinutes) *
              granularity.intervalMinutes,
            0,
            0,
          );
          return d;
      }
    },
    [granularity.intervalMinutes],
  );

  const { labels: xAxis, utcDates } = useMemo(() => {
    // Generate x-axis labels that match ClickHouse time bucketing exactly
    const labels = [];
    const dates = [];
    const utcDates = [];

    // Parse startDate and endDate as UTC (they come as ISO strings from useObservabilityContext)
    const start = new Date(startDate);
    const end = new Date(endDate);

    const intervalMinutes = granularity.intervalMinutes;

    // Start from the first ClickHouse interval boundary at or before start time
    let current = simulateClickHouseTimeBucketing(start);

    // For daily granularity, be more precise about end date to avoid extra intervals
    function shouldIncludeInterval(intervalDate: Date): boolean {
      if (granularity.intervalMinutes >= 1440) {
        // For daily intervals, only include if within the actual duration range
        const maxAllowedDate = new Date(
          start.getTime() + granularity.durationMs,
        );
        return intervalDate < maxAllowedDate;
      }
      return intervalDate < end;
    }

    while (shouldIncludeInterval(current)) {
      const formatOptions =
        granularity.displayFormat === 'HH:mm'
          ? {
              hour: '2-digit' as const,
              minute: '2-digit' as const,
              // Use local timezone for hourly display
            }
          : {
              month: 'short' as const,
              day: 'numeric' as const,
              timeZone: 'UTC',
            };

      // Create a UTC date key for matching with backend data
      const utcDateKey =
        granularity.intervalMinutes >= 1440
          ? current.toISOString().split('T')[0] // YYYY-MM-DD for daily
          : current.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm for hourly/minute

      labels.push(formatDate(current, formatOptions));
      dates.push(new Date(current));
      utcDates.push(utcDateKey);

      // Increment based on interval - use original approach
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
      utcDates: utcDates,
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

          // Parse the date from the item ensuring UTC interpretation
          let itemDate: Date;
          if (item.date.includes(':')) {
            // DateTime string - ensure it's treated as UTC
            itemDate = new Date(
              item.date.endsWith('Z') ? item.date : item.date + 'Z',
            );
          } else {
            // Date-only string like "2025-08-06" - parse as UTC midnight
            itemDate = new Date(item.date + 'T00:00:00.000Z');
          }
          const bucketedDate = simulateClickHouseTimeBucketing(itemDate);

          // Create same format key as x-axis generation
          const dateKey =
            granularity.intervalMinutes >= 1440
              ? bucketedDate.toISOString().split('T')[0] // YYYY-MM-DD for daily
              : bucketedDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm for hourly/minute

          acc[dateKey] = {
            value: typeof value === 'number' ? value : undefined,
            name: nameGetterFn ? nameGetterFn(item) : undefined,
          };

          return acc;
        },
        {} as Record<string, { name?: string; value: number | undefined }>,
      );

      // Map the data to the format required by the chart using UTC date keys
      return utcDates.map((utcDateKey) => {
        const item = mappedData[utcDateKey];

        if (typeof item?.value === 'undefined') {
          if (typeof defaultValue === 'number') {
            return { value: defaultValue, name: item?.name };
          }

          return { value: null, name: item?.name };
        }

        return item;
      });
    },
    [utcDates, granularity.intervalMinutes, simulateClickHouseTimeBucketing],
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
