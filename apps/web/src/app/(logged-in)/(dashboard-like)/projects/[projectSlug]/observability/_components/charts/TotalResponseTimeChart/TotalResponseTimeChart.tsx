'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  Chart,
  DashboardChartWrapper,
  makeFormattedTooltip,
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

  const { xAxis, seriesData } = useObservabilitySeriesData({
    data: data?.body.items,
    getterFn: (item) => item.averageResponseTimeMs / 1000, // Convert ms to seconds
    startDate,
    endDate,
  });

  const { formatSmallDuration } = useFormatters();

  return (
    <DashboardChartWrapper title={t('title')} isLoading={!data}>
      <Chart
        options={{
          grid: {
            left: 30,
            right: 20,
            bottom: 30,
            top: 15,
          },
          tooltip: {
            formatter: (e) => {
              const value = get(e, 'value', null);

              if (typeof value !== 'number') {
                return makeFormattedTooltip({
                  label: t('tooltip.noData'),
                });
              }

              return makeFormattedTooltip({
                label: t('tooltip.withValue'),
                value: formatSmallDuration(value * 1_000_000),
              });
            },
          },
          series: [
            {
              data: seriesData,
              type: 'line',
            },
          ],
          xAxis: {
            data: xAxis,
            type: 'category',
          },
          yAxis: {
            minInterval: 1,
            type: 'value',
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
