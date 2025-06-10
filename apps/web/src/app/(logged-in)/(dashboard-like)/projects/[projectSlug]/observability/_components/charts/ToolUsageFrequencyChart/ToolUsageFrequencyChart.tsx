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
import { useMemo } from 'react';

interface ToolUsageFrequencyChartProps {
  analysisLink?: string;
}

export function ToolUsageFrequencyChart(props: ToolUsageFrequencyChartProps) {
  const { startDate, endDate } = useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations(
    'pages/projects/observability/ToolUsageFrequencyChart',
  );

  const { data } = webApi.observability.getToolUsageByFrequency.useQuery({
    queryKey: webApiQueryKeys.observability.getToolUsageByFrequency({
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

  // Aggregate tool usage by tool_name by date
  const toolSeriesData = useMemo(() => {
    if (!data?.body.items) return [];

    interface ToolUsageItem {
      date: string;
      usageCount: number;
    }

    const groupedByName = data.body.items.reduce(
      (acc, item) => {
        const date = new Date(item.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        if (!acc[item.toolName]) {
          acc[item.toolName] = {};
        }
        acc[item.toolName][date] = {
          date,
          usageCount:
            (acc[item.toolName][date]?.usageCount || 0) + item.usageCount,
        };
        return acc;
      },
      {} as Record<string, Record<string, ToolUsageItem>>,
    );

    return Object.entries(groupedByName).map(([toolName, dates]) => ({
      name: toolName,
      data: Object.values(dates),
      getterFn: (item: ToolUsageItem) => item.usageCount || 0,
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
              const value = get(e, '0.data', null);

              if (typeof value !== 'number') {
                return makeFormattedTooltip({
                  label: t('tooltip.noData'),
                });
              }

              // Get top tools for this date
              const date = get(e, '0.name', '');
              const dateItems =
                data?.body.items.filter((item) => {
                  const itemDate = new Date(item.date);
                  const formattedDate = `${itemDate.toLocaleDateString('en-US', { month: 'short' })} ${itemDate.getDate()}`;
                  return formattedDate === date;
                }) || [];

              const topTools = dateItems
                .sort((a, b) => b.usageCount - a.usageCount)
                .slice(0, 3)
                .map(
                  (tool) =>
                    `${tool.toolName}: ${formatNumber(tool.usageCount)}`,
                )
                .join('<br/>');

              return makeFormattedTooltip({
                label: t('tooltip.withValue'),
                value: `${formatNumber(value)} total executions<br/><br/>Top tools:<br/>${topTools}`,
              });
            },
          },
        }}
      />
    </DashboardChartWrapper>
  );
}
