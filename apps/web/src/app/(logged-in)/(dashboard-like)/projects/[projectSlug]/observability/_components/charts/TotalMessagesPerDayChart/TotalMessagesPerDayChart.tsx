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

  const tableOptions = useObservabilitySeriesData({
    seriesData: [
      {
        data: data?.body.items,
        getterFn: (item) => item.totalMessages || 0,
        defaultValue: 0,
      },
    ],
    startDate,
    endDate,
  });

  const { formatNumber } = useFormatters();

  return (
    <DashboardChartWrapper title={t('title')} isLoading={!data}>
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
                  label: t('tooltip.noData'),
                  date,
                });
              }

              return makeFormattedTooltip({
                label: t('tooltip.withValue'),
                value: formatNumber(value),
                date,
              });
            },
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
