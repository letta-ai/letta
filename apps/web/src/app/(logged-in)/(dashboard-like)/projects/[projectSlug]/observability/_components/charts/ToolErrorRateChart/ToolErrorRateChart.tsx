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

interface ToolErrorRateChartProps {
  analysisLink?: string;
}

export function ToolErrorRateChart(props: ToolErrorRateChartProps) {
  const { startDate, endDate, baseTemplateId } = useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations('pages/projects/observability/ToolErrorRateChart');

  const { data } = webApi.observability.getToolErrorRatePerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getToolErrorRatePerDay({
      projectId,
      startDate,
      endDate,
      baseTemplateId: baseTemplateId?.value,
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
    seriesData: [
      {
        data: data?.body.items,
        getterFn: (item) => item.errorRate,
        defaultValue: 0,
      },
    ],
    formatter: (value) => {
      return `${value}%`;
    },
    startDate,
    endDate,
  });

  const { formatNumber } = useFormatters();

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
            max: 100,
          },
          tooltip: {
            trigger: 'axis',
            formatter: (e) => {
              const value = get(e, '0.data.value', null);
              const date = get(e, '0.axisValue', '') as string;

              if (typeof value !== 'number') {
                return makeFormattedTooltip({
                  label: t('tooltip.noData'),
                });
              }

              return makeFormattedTooltip({
                label: t('tooltip.withValue'),
                date: date,
                value:
                  formatNumber(value / 100, {
                    style: 'percent',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) || '0%',
              });
            },
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
