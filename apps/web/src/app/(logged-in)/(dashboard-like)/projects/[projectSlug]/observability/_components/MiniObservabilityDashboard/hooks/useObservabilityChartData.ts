import { useMemo } from 'react';

export interface ChartDataPoint {
  x: string;
  y: number;
}

interface ObservabilityData {
  messagesData?: { body: { items: Array<{ date: string; totalMessages?: number }> } };
  toolErrorsData?: { body: { items: Array<{ date: string; errorCount?: number }> } };
  stepsData?: { body: { items: Array<{ date: string; totalStepsCount?: number }> } };
  apiErrorsData?: { body: { items: Array<{ date: string; apiErrorCount?: number }> } };
  toolLatencyData?: { body: { items: Array<{ date: string; p50LatencyMs?: number; p99LatencyMs?: number }> } };
}

interface ObservabilityChartData {
  messagesChartData: ChartDataPoint[];
  toolErrorsChartData: ChartDataPoint[];
  stepsPerHourChartData: ChartDataPoint[];
  apiErrorsChartData: ChartDataPoint[];
  toolLatencyP50ChartData: ChartDataPoint[];
  toolLatencyP99ChartData: ChartDataPoint[];
  medianToolLatencyP50: number;
  medianToolLatencyP99: number;
}

export function useObservabilityChartData(data: ObservabilityData): ObservabilityChartData {
  const transformToChartData = <T>(
    items: T[] | undefined,
    dateField: keyof T,
    valueField: keyof T,
    transform?: (value: number) => number
  ): ChartDataPoint[] => {
    if (!items) return [];
    return items
      .sort((a, b) => new Date(a[dateField] as string).getTime() - new Date(b[dateField] as string).getTime())
      .map(item => ({
        x: item[dateField] as string,
        y: transform ? transform((item[valueField] as number) || 0) : (item[valueField] as number) || 0,
      }));
  };

  //instead of using WITH FILL on the backend, fill in missing data points with 0 to reduce network payload
  const fillMissingDataPoints = (
    sparseData: ChartDataPoint[],
    completeTimeSeriesTemplate: ChartDataPoint[]
  ): ChartDataPoint[] => {
    if (completeTimeSeriesTemplate.length === 0) {
      return sparseData;
    }

    if (sparseData.length === 0) {
      return completeTimeSeriesTemplate.map(point => ({
        x: point.x,
        y: 0,
      }));
    }

    const dataMap = new Map(sparseData.map(point => [point.x, point.y]));

    return completeTimeSeriesTemplate.map(templatePoint => ({
      x: templatePoint.x,
      y: dataMap.get(templatePoint.x) ?? 0,
    }));
  };

  const calculateMedianLatency = (
    items: Array<{ p50LatencyMs?: number; p99LatencyMs?: number }> | undefined,
    field: 'p50LatencyMs' | 'p99LatencyMs'
  ): number => {
    if (!items || items.length === 0) return 0;

    const validItems = items
      .filter(item => item[field] && item[field] > 0)
      .map(item => item[field] || 0)
      .sort((a, b) => a - b);

    if (validItems.length === 0) return 0;

    const mid = Math.floor(validItems.length / 2);
    const median = validItems.length % 2 === 0
      ? (validItems[mid - 1] + validItems[mid]) / 2
      : validItems[mid];

    return median * 1_000_000;
  };

  const messagesChartData = useMemo(() =>
    transformToChartData(data.messagesData?.body.items, 'date', 'totalMessages'),
    [data.messagesData]
  );

  const toolErrorsChartData = useMemo(() => {
    const sparseData = transformToChartData(data.toolErrorsData?.body.items, 'date', 'errorCount');
    return fillMissingDataPoints(sparseData, messagesChartData);
  }, [data.toolErrorsData, messagesChartData]);

  const stepsPerHourChartData = useMemo(() => {
    const sparseData = transformToChartData(data.stepsData?.body.items, 'date', 'totalStepsCount');
    return fillMissingDataPoints(sparseData, messagesChartData);
  }, [data.stepsData, messagesChartData]);

  const apiErrorsChartData = useMemo(() => {
    const sparseData = transformToChartData(data.apiErrorsData?.body.items, 'date', 'apiErrorCount');
    return fillMissingDataPoints(sparseData, messagesChartData);
  }, [data.apiErrorsData, messagesChartData]);

  const toolLatencyP50ChartData = useMemo(() => {
    const sparseData = transformToChartData(data.toolLatencyData?.body.items, 'date', 'p50LatencyMs');
    return fillMissingDataPoints(sparseData, messagesChartData);
  }, [data.toolLatencyData, messagesChartData]);

  const toolLatencyP99ChartData = useMemo(() => {
    const sparseData = transformToChartData(
      data.toolLatencyData?.body.items,
      'date',
      'p99LatencyMs',
      (value) => value * 1_000_000
    );
    return fillMissingDataPoints(sparseData, messagesChartData);
  }, [data.toolLatencyData, messagesChartData]);

  const medianToolLatencyP50 = useMemo(() =>
    calculateMedianLatency(data.toolLatencyData?.body.items, 'p50LatencyMs'),
    [data.toolLatencyData]
  );

  const medianToolLatencyP99 = useMemo(() =>
    calculateMedianLatency(data.toolLatencyData?.body.items, 'p99LatencyMs'),
    [data.toolLatencyData]
  );

  return {
    messagesChartData,
    toolErrorsChartData,
    stepsPerHourChartData,
    apiErrorsChartData,
    toolLatencyP50ChartData,
    toolLatencyP99ChartData,
    medianToolLatencyP50,
    medianToolLatencyP99,
  };
}
