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

export function TotalMessagesPerDayChart() {
  const { id: projectId } = useCurrentProject();
  const { startDate, endDate, startTimeUnix, endTimeUnix } =
    useObservabilitySeriesDates();

  const t = useTranslations(
    'pages/projects/observability/TotalMessagesPerDayChart',
  );

  const { data } = webApi.observability.getTotalMessagesPerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getTotalMessagesPerDay({
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
    getterFn: (item) => item.totalMessages,
    startDate,
    endDate,
  });

  const { formatNumber } = useFormatters();

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
              let value = get(e, 'value', null);

              if (typeof value !== 'number') {
                value = 0;
              }

              return makeFormattedTooltip({
                label: t('tooltip'),
                value: formatNumber(value),
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
