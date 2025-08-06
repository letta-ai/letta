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

interface LLMLatencyChartProps {
  analysisLink?: string;
}

export function LLMLatencyChart(props: LLMLatencyChartProps) {
  const { startDate, endDate, baseTemplateId, timeRange } =
    useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations('pages/projects/observability/LLMLatencyChart');

  const { data } = webApi.observability.getLLMLatencyPerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getLLMLatencyPerDay({
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

  const tableOptions = useObservabilitySeriesData({
    seriesData: [
      {
        data: data?.body.items,
        getterFn: (item) => item.p50LatencyMs,
      },
      {
        data: data?.body.items,
        getterFn: (item) => item.p99LatencyMs,
      },
    ],
    formatter: function (value) {
      return formatSmallDuration(value * 1_000_000).replace(' ', '');
    },
    startDate,
    endDate,
  });

  const { formatSmallDuration } = useFormatters();

  return (
    <DashboardChartWrapper
      analysisLink={analysisLink}
      title={t('title')}
      isLoading={!data}
      isEmpty={!data?.body.items?.length}
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
              const p50Response = get(e, '0.data.value', null);
              const p99Response = get(e, '1.data.value', null);
              const date = get(e, '0.axisValue', '');
              return makeMultiValueFormattedTooltip({
                date,
                options: [
                  {
                    color: get(e, '0.color', '#333') as string,
                    label: t('p50Latency.label'),
                    value:
                      typeof p50Response === 'number'
                        ? formatSmallDuration(p50Response * 1_000_000)
                        : '-',
                  },
                  {
                    color: get(e, '1.color', '#555') as string,
                    label: t('p99Latency.label'),
                    value:
                      typeof p99Response === 'number'
                        ? formatSmallDuration(p99Response * 1_000_000)
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
