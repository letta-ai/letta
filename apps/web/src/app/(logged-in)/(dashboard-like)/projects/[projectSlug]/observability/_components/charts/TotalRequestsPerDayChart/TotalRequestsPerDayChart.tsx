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

export function TotalRequestsPerDayChart() {
  const { id: projectId } = useCurrentProject();
  const { startDate, endDate, baseTemplateId, timeRange } =
    useObservabilityContext();

  const { data } = webApi.observability.getTotalRequestsPerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getTotalRequestsPerDay({
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

  const tableOptions = useObservabilitySeriesData({
    seriesData: [
      {
        data: data?.body.items,
        getterFn: (item) => item.totalRequests || 0,
        defaultValue: 0,
      },
    ],
    startDate,
    endDate,
  });

  const { formatNumber } = useFormatters();

  function getTitle(): string {
    switch (timeRange) {
      case '1h':
        return 'Total requests per 5 minutes';
      case '4h':
        return 'Total requests per 20 minutes';
      case '12h':
        return 'Total requests per hour';
      case '1d':
        return 'Total requests per hour';
      case '7d':
        return 'Total requests per day';
      case '30d':
        return 'Total requests per day';
      default:
        return 'Total requests';
    }
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
                label: 'Requests',
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
