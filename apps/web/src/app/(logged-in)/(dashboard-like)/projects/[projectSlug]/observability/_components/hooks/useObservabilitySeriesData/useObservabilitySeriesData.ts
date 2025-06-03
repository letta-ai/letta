import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormatters } from '@letta-cloud/utils-client';
import { useCurrentUser } from '$web/client/hooks';
import type { EChartsOption, SeriesOption } from 'echarts';

interface BaseType {
  date: string; // Assuming the date is in YYYY-MM-DD format
}

interface UseSeriesDataOptions<T extends BaseType> {
  startDate: string;
  endDate: string;
  seriesData: Array<{
    data?: T[] | null;
    defaultValue?: number;
    getterFn: (data: T) => number;
  }>;
}

export function useObservabilitySeriesData<T extends BaseType>(
  options: UseSeriesDataOptions<T>,
): Partial<EChartsOption> {
  const { startDate, endDate, seriesData } = options;

  const { formatDate } = useFormatters();

  const { labels: xAxis } = useMemo(() => {
    // Generate x-axis labels based on the date range
    const labels = [];
    const dates = [];

    for (
      let date = new Date(startDate);
      date < new Date(endDate);
      date.setDate(date.getDate() + 1)
    ) {
      labels.push(
        formatDate(date, {
          month: 'short',
          day: 'numeric',
        }),
      );
      dates.push(date);
    }

    return {
      labels: labels.slice(0, -1),
      dates: dates.slice(0, -1),
    };
  }, [startDate, endDate, formatDate]);

  const getSeriesData = useCallback(
    (
      data: T[] | null | undefined,
      getterFn: (data: T) => number,
      defaultValue?: number,
    ) => {
      if (!data) return [];

      const mappedData = data.reduce(
        (acc, item) => {
          acc[
            formatDate(item.date, {
              month: 'short',
              day: 'numeric',
            })
          ] = getterFn(item) || 0; // Use the getter function to extract the value

          return acc;
        },
        {} as Record<string, number>,
      );

      // Map the data to the format required by the chart
      return xAxis.map((date) => {
        const dateKey = date; // Assuming date is in YYYY-MM-DD format
        const item = mappedData[dateKey];

        if (typeof item === 'undefined') {
          if (typeof defaultValue === 'number') {
            return defaultValue;
          }

          return undefined;
        }

        return item;
      });
    },
    [xAxis, formatDate],
  );

  const series: SeriesOption[] = useMemo(() => {
    return seriesData.map((item) => {
      const { data, getterFn, defaultValue } = item;

      return {
        type: 'line',
        connectNulls: true,
        symbol: 'circle',
        data: getSeriesData(data, getterFn, defaultValue),
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
        left: 32,
        right: 0,
        bottom: 30,
        top: 15,
      },
      series,
    }),
    [styles, xAxis, series, formatShorthandNumber],
  );
}
