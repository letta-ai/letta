'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  Chart,
  DashboardChartWrapper,
  makeMultiValueFormattedTooltip,
} from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { get } from 'lodash-es';
import { useObservabilitySeriesData } from '../../hooks/useObservabilitySeriesData/useObservabilitySeriesData';
import { useObservabilityContext } from '../../hooks/useObservabilityContext/useObservabilityContext';

interface ToolLatencyChartProps {
  analysisLink?: string;
}

export function ToolLatencyChart(props: ToolLatencyChartProps) {
  const { startDate, endDate } = useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations('pages/projects/observability/ToolLatencyChart');

  const { data } = webApi.observability.getToolLatencyPerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getToolLatencyPerDay({
      projectId,
      startDate,
      endDate,
    }),
    queryData: {
      query: {
        projectId,
        startDate,
        endDate,
      },
    },
  });

  const tableOptions = useObservabilitySeriesData({
    formatter: (value) => {
      return `${value}ms`;
    },
    seriesData: [
      {
        data: data?.body.items,
        getterFn: (item) => item.p50LatencyMs,
      },
      {
        data: data?.body.items,
        getterFn: (item) => item.p99LatencyMs,
      },
    ],
    startDate,
    endDate,
  });

  const { formatSmallDuration } = useFormatters();

  return (
    <DashboardChartWrapper
      analysisLink={analysisLink}
      title={t('title')}
      isLoading={!data}
    >
      <Chart
        options={{
          ...tableOptions,
          yAxis: {
            ...tableOptions.yAxis,
            startValue: 0,
          },
          grid: {
            ...tableOptions.grid,
            left: 45,
          },
          tooltip: {
            trigger: 'axis',
            formatter: (e) => {
              const p50Latency = get(e, '0.data.value', null);
              const p99Latency = get(e, '1.data', null);

              const date = get(e, '0.axisValue', '') as string;
              return makeMultiValueFormattedTooltip({
                date,
                options: [
                  {
                    color: get(e, '0.color', '#333') as string,
                    label: t('p50Latency.label'),
                    value:
                      typeof p50Latency === 'number'
                        ? formatSmallDuration(p50Latency * 1_000_000) // Convert ms to ns
                        : '-',
                  },
                  {
                    color: get(e, '1.color', '#555') as string,
                    label: t('p99Latency.label'),
                    value:
                      typeof p99Latency === 'number'
                        ? formatSmallDuration(p99Latency * 1_000_000) // Convert ms to ns
                        : '-',
                  },
                ],
              });
            },
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
