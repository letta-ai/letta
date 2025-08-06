'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  Chart,
  DashboardChartWrapper,
  makeFormattedTooltip,
  makeMultiValueFormattedTooltip,
} from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { get } from 'lodash-es';
import { useObservabilitySeriesData } from '../../hooks/useObservabilitySeriesData/useObservabilitySeriesData';
import { useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';
import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';

interface StepDurationByNameChartProps {
  analysisLink?: string;
  type: 'p50' | 'p99';
}

export function StepDurationByNameChart({
  type,
  analysisLink,
}: StepDurationByNameChartProps) {
  const { startDate, endDate, baseTemplateId, timeRange } =
    useObservabilityContext();
  const { id: projectId } = useCurrentProject();

  const t = useTranslations(
    'pages/projects/observability/StepDurationByNameChart',
  );

  const { data } = webApi.observability.getStepDurationMetrics.useQuery({
    queryKey: webApiQueryKeys.observability.getStepDurationMetrics({
      projectId,
      startDate,
      endDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        projectId,
        startDate,
        endDate,
        baseTemplateId: baseTemplateId?.value,
        timeRange,
      },
    },
  });

  const { formatSmallDuration } = useFormatters();

  interface StepSeriesData {
    date: string;
    durationNs: number;
    name: string;
  }

  // Group data by step name for multiple series
  interface StepSeriesType {
    stepName: string;
    data: StepSeriesData[];
  }

  const stepSeries: StepSeriesType[] = useMemo(() => {
    if (!data?.body.items) return [];

    const stepMap = new Map<string, StepSeriesData[]>();

    data.body.items.forEach((item) => {
      if (!stepMap.has(item.stepName)) {
        stepMap.set(item.stepName, []);
      }
      stepMap.get(item.stepName)?.push({
        date: item.date,
        durationNs: type === 'p50' ? item.p50DurationNs : item.p99DurationNs,
        name: item.stepName || '',
      });
    });

    // Convert to array
    return Array.from(stepMap.entries()).map(([stepName, data]) => ({
      stepName,
      data,
    }));
  }, [data?.body.items, type]);

  const tableOptions = useObservabilitySeriesData<StepSeriesData>({
    seriesData: stepSeries.map((step) => ({
      data: step.data,
      getterFn: (item) => item.durationNs,
      nameGetterFn: (item) => {
        if (item.name === 'send_message') {
          return 'Assistant Message';
        }

        return `Tool Run (${item.name})`;
      },
    })),
    startDate,
    endDate,
    formatter: (value: number) => {
      return formatSmallDuration(value).replace(' ', ''); // Value is already in ns
    },
  });

  // Customize options to add series names and styling
  const chartOptions: Partial<EChartsOption> = useMemo(
    () => ({
      ...tableOptions,
      grid: {
        ...tableOptions.grid,
        left: 45,
      },
      series: tableOptions.series,
      yAxis: {
        ...tableOptions.yAxis,
        startValue: 0,
      },
      tooltip: {
        trigger: 'axis',
        formatter: (e) => {
          if (!Array.isArray(e) || e.length === 0) {
            return '';
          }

          const date = get(e, '0.axisValue', '');

          const options = e
            .filter((param) => {
              const value = get(param, 'data.value', null);

              return (
                !!value &&
                typeof value === 'number' &&
                value >= 0 &&
                get(param, 'data.name', '')
              );
            })
            .map((param) => {
              let value = get(param, 'data.value', '');

              if (typeof value !== 'number') {
                // @ts-expect-error type conversion
                value = parseInt(value, 10);
              }

              if (isNaN(value)) {
                value = 0;
              }

              return {
                color: param.color as string,
                label: `${get(param, 'data.name', '')}`,
                value: formatSmallDuration(value), // Value is already in ns
              };
            });

          if (options.length === 0) {
            return makeFormattedTooltip({
              date,
              label: 'No data',
            });
          }

          return makeMultiValueFormattedTooltip({
            date,
            options,
          });
        },
      },
    }),
    [tableOptions, formatSmallDuration],
  );

  return (
    <DashboardChartWrapper
      analysisLink={analysisLink}
      title={t('title', { type })}
      info={t('info')}
      isLoading={!data}
      isEmpty={!data?.body.items?.length}
    >
      <Chart options={chartOptions} />
    </DashboardChartWrapper>
  );
}
