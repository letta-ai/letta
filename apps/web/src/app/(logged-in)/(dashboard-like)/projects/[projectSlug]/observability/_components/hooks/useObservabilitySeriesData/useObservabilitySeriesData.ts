import { useMemo } from 'react';
import { useFormatters } from '@letta-cloud/utils-client';

interface BaseType {
  date: string; // Assuming the date is in YYYY-MM-DD format
}

interface UseSeriesDataOptions<T extends BaseType> {
  startDate: string;
  endDate: string;
  data?: T[] | null;
  getterFn: (data: T) => number;
}

export function useObservabilitySeriesData<T extends BaseType>(
  options: UseSeriesDataOptions<T>,
) {
  const { startDate, endDate, getterFn, data } = options;

  const { formatDate } = useFormatters();

  const xAxis = useMemo(() => {
    // Generate x-axis labels based on the date range
    const labels = [];

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
    }

    return labels.slice(0, -1);
  }, [startDate, endDate, formatDate]);

  const seriesData = useMemo(() => {
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

      return item || undefined;
    });
  }, [formatDate, data, getterFn, xAxis]);

  return {
    xAxis,
    seriesData,
  };
}
