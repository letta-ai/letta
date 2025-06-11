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
import type { EChartsOption } from 'echarts';

interface LLMLatencyByToolNameChartProps {
  analysisLink?: string;
}

export function LLMLatencyByToolNameChart(
  props: LLMLatencyByToolNameChartProps,
) {
  const { startDate, endDate } = useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations(
    'pages/projects/observability/LLMLatencyByToolNameChart',
  );

  const { data } = webApi.observability.getToolLatencyByName.useQuery({
    queryKey: webApiQueryKeys.observability.getToolLatencyByName({
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

  const { formatSmallDuration } = useFormatters();

  interface ToolSeriesData {
    date: string;
    avgLatencyMs: number;
    name: string;
  }

  // Group data by tool name for multiple series
  interface ToolSeriesType {
    toolName: string;
    data: ToolSeriesData[];
  }

  const toolSeries: ToolSeriesType[] = useMemo(() => {
    if (!data?.body.items) return [];

    const toolMap = new Map<string, ToolSeriesData[]>();

    data.body.items.forEach((item) => {
      // filter out send_message
      if (item.toolName === 'send_message') {
        return;
      }

      if (!toolMap.has(item.toolName)) {
        toolMap.set(item.toolName, []);
      }
      toolMap.get(item.toolName)?.push({
        date: item.date,
        avgLatencyMs: item.avgLatencyMs,
        name: item.toolName || '',
      });
    });

    // Convert to array and sort by average latency
    return Array.from(toolMap.entries()).map(([toolName, data]) => ({
      toolName,
      data,
    }));
  }, [data]);

  const tableOptions = useObservabilitySeriesData<ToolSeriesData>({
    seriesData: toolSeries.map((tool) => ({
      data: tool.data,
      getterFn: (item) => item.avgLatencyMs,
      nameGetterFn: (item) => item.name,
    })),
    startDate,
    endDate,
    formatter: (value: number) => {
      return formatSmallDuration(value * 1_000_000).replace(' ', ''); // Convert ms to ns
    },
  });

  // Customize options to add series names and styling
  const chartOptions: Partial<EChartsOption> = useMemo(
    () => ({
      ...tableOptions,
      grid: {
        ...tableOptions.grid,
        left: 45,
      },
      series: tableOptions.series,
      yAxis: {
        ...tableOptions.yAxis,
        startValue: 0,
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
                value: formatSmallDuration(value * 1_000_000), // Convert ms to ns
              };
            });

          if (options.length === 0) {
            return makeFormattedTooltip({
              date,
              label: t('noData'),
            });
          }

          return makeMultiValueFormattedTooltip({
            date,
            options,
          });
        },
      },
    }),
    [tableOptions, formatSmallDuration, t],
  );

  return (
    <DashboardChartWrapper
      analysisLink={analysisLink}
      title={t('title')}
      isLoading={!data}
      isEmpty={!data?.body.items?.length}
    >
      <Chart options={chartOptions} />
    </DashboardChartWrapper>
  );
}
