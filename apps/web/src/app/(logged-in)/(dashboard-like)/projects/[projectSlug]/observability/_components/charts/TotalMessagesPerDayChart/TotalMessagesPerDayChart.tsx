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

export function TotalMessagesPerDayChart() {
  const { id: projectId } = useCurrentProject();
  const { startDate, endDate } = useObservabilityContext();
  const t = useTranslations(
    'pages/projects/observability/TotalMessagesPerDayChart',
  );

  const { data } = webApi.observability.getTotalMessagesPerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getTotalMessagesPerDay({
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
            trigger: 'axis',
            formatter: (e) => {
              const value = get(e, '0.data', null);

              if (typeof value !== 'number') {
                return makeFormattedTooltip({
                  label: t('tooltip.noData'),
                });
              }

              return makeFormattedTooltip({
                label: t('tooltip.withValue'),
                value: formatNumber(value),
              });
            },
          },
          series: [
            {
              symbol: 'dot',
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
