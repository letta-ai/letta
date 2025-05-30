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

interface TimeToFirstTokenChartProps {
  analysisLink?: string;
}

export function TimeToFirstTokenChart(props: TimeToFirstTokenChartProps) {
  const { startDate, endDate } = useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations(
    'pages/projects/observability/TimeToFirstTokenChart',
  );

  const { data } = webApi.observability.getTimeToFirstTokenMetrics.useQuery({
    queryKey: webApiQueryKeys.observability.getTimeToFirstTokenMetrics({
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
        getterFn: (item) => item.averageTimeToFirstTokenMs / 1000,
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
                value: formatSmallDuration(value * 1_000_000),
              });
            },
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
