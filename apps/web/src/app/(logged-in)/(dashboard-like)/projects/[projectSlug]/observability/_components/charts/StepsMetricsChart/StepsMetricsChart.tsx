'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  Chart,
  DashboardChartWrapper,
  makeFormattedTooltip,
} from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';

import { get } from 'lodash-es';
import { useObservabilitySeriesData } from '../../hooks/useObservabilitySeriesData/useObservabilitySeriesData';

import { useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';

interface StepsMetricsChartProps {
  type: 'avg' | 'p50' | 'p99' | 'total';
}

export function StepsMetricsChart({ type }: StepsMetricsChartProps) {
  const { id: projectId } = useCurrentProject();
  const { startDate, endDate, baseTemplateId, timeRange } =
    useObservabilityContext();

  const { data } = webApi.observability.getStepsMetrics.useQuery({
    queryKey: webApiQueryKeys.observability.getStepsMetrics({
      projectId: projectId,
      startDate,
      endDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        baseTemplateId: baseTemplateId?.value,
        projectId: projectId,
        startDate,
        endDate,
        timeRange,
      },
    },
  });

  function getValueFromItem(item: {
    totalStepsCount?: number;
    p50StepsCount?: number;
    p99StepsCount?: number;
    avgStepsCount?: number;
  }) {
    switch (type) {
      case 'total':
        return item.totalStepsCount || 0;
      case 'p50':
        return item.p50StepsCount || 0;
      case 'p99':
        return item.p99StepsCount || 0;
      case 'avg':
        return item.avgStepsCount || 0;
      default:
        return 0;
    }
  }

  const tableOptions = useObservabilitySeriesData({
    seriesData: [
      {
        data: data?.body.items,
        getterFn: getValueFromItem,
        defaultValue: 0,
      },
    ],
    startDate,
    endDate,
  });

  const { formatNumber } = useFormatters();

  function getTimeDescription(): string {
    switch (timeRange) {
      case '1h':
        return 'per 5 minutes';
      case '4h':
        return 'per 20 minutes';
      case '12h':
        return 'per hour';
      case '1d':
        return 'per hour';
      case '7d':
        return 'per day';
      case '30d':
        return 'per day';
      default:
        return '';
    }
  }

  function getTitle(): string {
    const timeDesc = getTimeDescription();

    switch (type) {
      case 'total':
        return `Total steps ${timeDesc}`;
      case 'p50':
        return `Steps per request (P50) ${timeDesc}`;
      case 'p99':
        return `Steps per request (P99) ${timeDesc}`;
      case 'avg':
        return `Steps per request (Average) ${timeDesc}`;
      default:
        return 'Steps metrics';
    }
  }

  function formatValue(value: number): string {
    return formatNumber(value);
  }

  return (
    <DashboardChartWrapper title={getTitle()} isLoading={!data}>
      <Chart
        options={{
          ...tableOptions,
          yAxis: {
            ...tableOptions.yAxis,
            minInterval: 1,
            type: 'value',
          },
          tooltip: {
            trigger: 'axis',
            formatter: (e) => {
              const value = get(e, '0.data.value', null);
              const date = get(e, '0.axisValue', '');

              if (typeof value !== 'number') {
                return makeFormattedTooltip({
                  label: 'No data was recorded for this date',
                  date,
                });
              }

              return makeFormattedTooltip({
                label: 'Steps',
                value: formatValue(value),
                date,
              });
            },
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
