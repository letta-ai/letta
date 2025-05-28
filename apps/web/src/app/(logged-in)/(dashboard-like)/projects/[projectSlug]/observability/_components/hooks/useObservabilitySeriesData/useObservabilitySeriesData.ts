import { useMemo } from 'react';

interface BaseType {
  date: string; // Assuming the date is in YYYY-MM-DD format
}

interface UseSeriesDataOptions<T extends BaseType> {
  startDate: Date;
  endDate: Date;
  data?: T[] | null;
  getterFn: (data: T) => number;
}

export function useObservabilitySeriesData<T extends BaseType>(
  options: UseSeriesDataOptions<T>,
) {
  const { startDate, endDate, getterFn, data } = options;

  const xAxis = useMemo(() => {
    // Generate x-axis labels based on the date range
    const labels = [];

    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      labels.push(date.toISOString().split('T')[0]); // Format as YYYY-MM-DD
    }

    return labels;
  }, [startDate, endDate]);

  const seriesData = useMemo(() => {
    if (!data) return [];

    const mappedData = data.reduce(
      (acc, item) => {
        acc[item.date] = getterFn(item) || 0; // Use the getter function to extract the value

        return acc;
      },
      {} as Record<string, number>,
    );

    // Map the data to the format required by the chart
    return xAxis.map((date) => {
      const dateKey = date; // Assuming date is in YYYY-MM-DD format
      const item = mappedData[dateKey];

      return item || 0;
    });
  }, [data, getterFn, xAxis]);

  return {
    xAxis,
    seriesData,
  };
}
