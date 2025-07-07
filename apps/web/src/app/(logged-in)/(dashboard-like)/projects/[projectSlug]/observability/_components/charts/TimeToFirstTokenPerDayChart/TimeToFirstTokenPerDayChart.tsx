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

interface TimeToFirstTokenPerDayChartProps {
  analysisLink?: string;
}

export function TimeToFirstTokenPerDayChart(
  props: TimeToFirstTokenPerDayChartProps,
) {
  const { startDate, endDate, baseTemplateId } = useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations(
    'pages/projects/observability/TimeToFirstTokenPerDayChart',
  );

  const { data } = webApi.observability.getTimeToFirstTokenPerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getTimeToFirstTokenPerDay({
      projectId,
      startDate,
      baseTemplateId: baseTemplateId?.value,
      endDate,
    }),
    queryData: {
      query: {
        projectId,
        startDate,
        baseTemplateId: baseTemplateId?.value,
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
        getterFn: (item) => item.p50TtftMs,
      },
      {
        data: data?.body.items,
        getterFn: (item) => item.p99TtftMs,
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
          tooltip: {
            trigger: 'axis',
            formatter: (e) => {
              const p50Value = get(e, '0.data.value', null);
              const p99Value = get(e, '1.data', null);
              const date = get(e, '0.axisValue', '') as string;

              return makeMultiValueFormattedTooltip({
                date,
                options: [
                  {
                    color: get(e, '0.color', '#333') as string,
                    label: t('p50Ttft.label'),
                    value:
                      typeof p50Value === 'number'
                        ? formatSmallDuration(p50Value * 1_000_000) // Convert ms to ns
                        : '-',
                  },
                  {
                    color: get(e, '1.color', '#555') as string,
                    label: t('p99Ttft.label'),
                    value:
                      typeof p99Value === 'number'
                        ? formatSmallDuration(p99Value * 1_000_000) // Convert ms to ns
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
