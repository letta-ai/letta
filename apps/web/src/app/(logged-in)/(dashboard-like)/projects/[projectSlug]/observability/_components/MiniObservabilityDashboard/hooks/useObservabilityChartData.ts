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

  const calculateMedianLatency = (
    items: Array<{ p50LatencyMs?: number; p99LatencyMs?: number }> | undefined,
    field: 'p50LatencyMs' | 'p99LatencyMs'
  ): number => {
    if (!items || items.length === 0) return 0;

    const validItems = items
      .filter(item => item[field] && item[field]! > 0)
      .map(item => item[field]!)
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

  const toolErrorsChartData = useMemo(() =>
    transformToChartData(data.toolErrorsData?.body.items, 'date', 'errorCount'),
    [data.toolErrorsData]
  );

  const stepsPerHourChartData = useMemo(() =>
    transformToChartData(data.stepsData?.body.items, 'date', 'totalStepsCount'),
    [data.stepsData]
  );

  const apiErrorsChartData = useMemo(() =>
    transformToChartData(data.apiErrorsData?.body.items, 'date', 'apiErrorCount'),
    [data.apiErrorsData]
  );

  const toolLatencyP50ChartData = useMemo(() =>
    transformToChartData(data.toolLatencyData?.body.items, 'date', 'p50LatencyMs'),
    [data.toolLatencyData]
  );

  const toolLatencyP99ChartData = useMemo(() =>
    transformToChartData(
      data.toolLatencyData?.body.items,
      'date',
      'p99LatencyMs',
      (value) => value * 1_000_000
    ),
    [data.toolLatencyData]
  );

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
