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
import { useObservabilitySeriesDates } from '../../hooks/useObservabilitySeriesDates/useObservabilitySeriesDates';

export function TotalResponseTimeChart() {
  const { id: projectId } = useCurrentProject();
  const { startDate, endDate, startTimeUnix, endTimeUnix } =
    useObservabilitySeriesDates();

  const t = useTranslations(
    'pages/projects/observability/TotalResponseTimeChart',
  );

  const { data } = webApi.observability.getAverageResponseTime.useQuery({
    queryKey: webApiQueryKeys.observability.getAverageResponseTime({
      projectId: projectId, // Replace with actual project slug
      startTimeUnix,
      endTimeUnix,
    }),
    queryData: {
      query: {
        projectId: projectId,
        startTimeUnix,
        endTimeUnix,
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
            type: 'value',
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
