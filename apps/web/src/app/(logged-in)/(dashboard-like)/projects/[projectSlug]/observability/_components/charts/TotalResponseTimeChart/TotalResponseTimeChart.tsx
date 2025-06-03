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

export function TotalResponseTimeChart() {
  const { id: projectId } = useCurrentProject();
  const { startDate, endDate } = useObservabilityContext();

  const t = useTranslations(
    'pages/projects/observability/TotalResponseTimeChart',
  );

  const { data } = webApi.observability.getAverageResponseTime.useQuery({
    queryKey: webApiQueryKeys.observability.getAverageResponseTime({
      projectId: projectId, // Replace with actual project slug
      startDate,
      endDate,
    }),
    queryData: {
      query: {
        projectId: projectId,
        startDate,
        endDate,
      },
    },
  });

  const tableOptions = useObservabilitySeriesData({
    seriesData: [
      {
        data: data?.body.items,
        getterFn: (item) => item.p50ResponseTimeNs / 1_000_000_000, // Convert to seconds
      },
      {
        data: data?.body.items,
        getterFn: (item) => item.p99ResponseTimeNs / 1_000_000_000, // Convert to seconds
      },
    ],
    startDate,
    endDate,
  });

  const { formatSmallDuration } = useFormatters();

  return (
    <DashboardChartWrapper title={t('title')} isLoading={!data}>
      <Chart
        options={{
          ...tableOptions,
          tooltip: {
            trigger: 'axis',
            formatter: (e) => {
              const p50Response = get(e, '0.data', null);
              const p99Response = get(e, '1.data', null);

              return makeMultiValueFormattedTooltip({
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
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
