'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  Chart,
  DashboardChartWrapper,
  makeFormattedTooltip,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { get } from 'lodash-es';
import { useObservabilitySeriesData } from '../../hooks/useObservabilitySeriesData/useObservabilitySeriesData';
import { useObservabilityContext } from '../../hooks/useObservabilityContext/useObservabilityContext';

interface TimeToFirstTokenChartProps {
  analysisLink?: string;
}

export function ToolErrorsChart(props: TimeToFirstTokenChartProps) {
  const { startDate, endDate } = useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations('pages/projects/observability/ToolErrorsChart');

  const { data } = webApi.observability.getToolErrorsMetrics.useQuery({
    queryKey: webApiQueryKeys.observability.getToolErrorsMetrics({
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
    seriesData: [
      {
        data: data?.body.items,
        getterFn: (item) => item.errorCount || 0,
        defaultValue: 0,
      },
    ],
    startDate,
    endDate,
  });

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
            minInterval: 1,
            max: function (value) {
              return Math.max(value.max, 5);
            },
          },
          tooltip: {
            trigger: 'axis',
            formatter: (e) => {
              const value = get(e, '0.data.value', null);
              const date = get(e, '0.axisValue', '');

              return makeFormattedTooltip({
                label: t('tooltip'),
                date: date,

                value: `${value || 0}`,
              });
            },
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
