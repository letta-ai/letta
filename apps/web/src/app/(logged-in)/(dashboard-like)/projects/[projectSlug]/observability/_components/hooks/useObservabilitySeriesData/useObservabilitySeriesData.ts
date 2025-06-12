import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormatters } from '@letta-cloud/utils-client';
import { useCurrentUser } from '$web/client/hooks';
import type { EChartsOption, SeriesOption } from 'echarts';
import { addDays } from 'date-fns';

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

  const { formatDate } = useFormatters();

  const { labels: xAxis } = useMemo(() => {
    // Generate x-axis labels based on the date range
    const labels = [];
    const dates = [];

    console.log(startDate, endDate);
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
      labels: labels,
      dates: dates,
    };
  }, [startDate, endDate, formatDate]);

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

          acc[
            formatDate(addDays(item.date, 1), {
              month: 'short',
              day: 'numeric',
            })
          ] = {
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
    [xAxis, formatDate],
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
