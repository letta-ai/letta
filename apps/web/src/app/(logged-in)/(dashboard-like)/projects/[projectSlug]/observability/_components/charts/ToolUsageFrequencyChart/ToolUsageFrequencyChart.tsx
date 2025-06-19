'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  Chart,
  DashboardChartWrapper,
  makeFormattedTooltip,
  makeMultiValueFormattedTooltip,
} from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { get } from 'lodash-es';
import { useObservabilitySeriesData } from '../../hooks/useObservabilitySeriesData/useObservabilitySeriesData';
import { useObservabilityContext } from '../../hooks/useObservabilityContext/useObservabilityContext';
import { useMemo } from 'react';

interface ToolUsageFrequencyChartProps {
  analysisLink?: string;
}

export function ToolUsageFrequencyChart(props: ToolUsageFrequencyChartProps) {
  const { startDate, endDate, baseTemplateId } = useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations(
    'pages/projects/observability/ToolUsageFrequencyChart',
  );

  const { data } = webApi.observability.getToolUsageByFrequency.useQuery({
    queryKey: webApiQueryKeys.observability.getToolUsageByFrequency({
      projectId,
      baseTemplateId: baseTemplateId?.value,
      startDate,
      endDate,
    }),
    queryData: {
      query: {
        baseTemplateId: baseTemplateId?.value,
        projectId,
        startDate,
        endDate,
      },
    },
  });

  // Aggregate tool usage by tool_name by date
  const toolSeriesData = useMemo(() => {
    if (!data?.body.items) return [];

    interface ToolUsageItem {
      date: string;
      usageCount: number;
      name: string;
    }

    const groupedByName = data.body.items.reduce(
      (acc, item) => {
        // filter out send_message tool
        if (item.toolName === 'send_message') {
          return acc;
        }

        if (!acc[item.toolName]) {
          acc[item.toolName] = {};
        }
        acc[item.toolName][item.date] = {
          date: item.date,
          name: item.toolName,
          usageCount:
            (acc[item.toolName][item.date]?.usageCount || 0) + item.usageCount,
        };
        return acc;
      },
      {} as Record<string, Record<string, ToolUsageItem>>,
    );

    return Object.entries(groupedByName).map(([toolName, dates]) => ({
      name: toolName,
      data: Object.values(dates),
      getterFn: (item: ToolUsageItem) => item.usageCount || 0,
      nameGetterFn: (item: ToolUsageItem) => item.name,
      defaultValue: 0,
    }));
  }, [data?.body.items]);

  const tableOptions = useObservabilitySeriesData({
    seriesData: toolSeriesData,
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
            minInterval: 1,
            max: function (value) {
              return Math.max(value.max, 5);
            },
          },
          tooltip: {
            trigger: 'axis',
            formatter: (e) => {
              if (!Array.isArray(e) || e.length === 0) {
                return '';
              }

              const date = get(e, '0.axisValue', '');

              const options = e
                .filter((param) => {
                  const value = get(param, 'data.value', null);

                  return (
                    !!value &&
                    typeof value === 'number' &&
                    value >= 0 &&
                    get(param, 'data.name', '')
                  );
                })
                .map((param) => {
                  let value = get(param, 'data.value', '');

                  if (typeof value !== 'number') {
                    // @ts-expect-error =-f afsd
                    value = parseInt(value, 10);
                  }

                  if (isNaN(value)) {
                    value = 0;
                  }

                  return {
                    color: param.color as string,
                    label: `${get(param, 'data.name', '')}`,
                    value: formatNumber(value, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }),
                  };
                });

              if (options.length === 0) {
                return makeFormattedTooltip({
                  date,
                  label: t('tooltip.noData'),
                });
              }

              return makeMultiValueFormattedTooltip({
                date,
                options,
              });
            },
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
