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
import { useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';

export function TotalResponseTimeChart() {
  const { id: projectId } = useCurrentProject();
  const { startDate, endDate, baseTemplateId, timeRange } =
    useObservabilityContext();

  const t = useTranslations(
    'pages/projects/observability/TotalResponseTimeChart',
  );

  const { data } = webApi.observability.getAverageResponseTime.useQuery({
    queryKey: webApiQueryKeys.observability.getAverageResponseTime({
      projectId: projectId, // Replace with actual project slug
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

  const { formatSmallDuration } = useFormatters();

  const tableOptions = useObservabilitySeriesData({
    seriesData: [
      {
        data: data?.body.items,
        getterFn: (item) => {
          if (!item.p50ResponseTimeNs) return null;

          return item.p50ResponseTimeNs / 1_000_000_000;
        }, // Convert to seconds
      },
      {
        data: data?.body.items,
        getterFn: (item) => {
          if (!item.p99ResponseTimeNs) return null;

          return item.p99ResponseTimeNs / 1_000_000_000;
        },
      },
    ],
    startDate,
    endDate,
    formatter: function (value) {
      return formatSmallDuration(value * 1_000_000_000); // Convert seconds to nanoseconds
    },
  });

  return (
    <DashboardChartWrapper title={t('title')} isLoading={!data}>
      <Chart
        options={{
          ...tableOptions,
          grid: {
            ...tableOptions.grid,
          },
          tooltip: {
            trigger: 'axis',
            formatter: (e) => {
              const p50Response = get(e, '0.data.value', null);
              const p99Response = get(e, '1.data.value', null);
              const date = get(e, '0.axisValue', '');
              return makeMultiValueFormattedTooltip({
                date,
                options: [
                  {
                    color: get(e, '0.color', '#333') as string,
                    label: t('p50ResponseTime.label'),
                    value:
                      typeof p50Response === 'number'
                        ? formatSmallDuration(p50Response * 1_000_000_000)
                        : '-',
                  },
                  {
                    color: get(e, '1.color', '#555') as string,
                    label: t('p99ResponseTime.label'),
                    value:
                      typeof p99Response === 'number'
                        ? formatSmallDuration(p99Response * 1_000_000_000)
                        : '-',
                  },
                ],
              });
            },
          },
          yAxis: {
            ...tableOptions.yAxis,
            startValue: 0,
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
