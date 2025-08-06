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
import { useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';
import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';

interface ToolLatencyByToolNameChartProps {
  analysisLink?: string;
  type: 'p50' | 'p99';
}

export function LLMLatencyByModelNameChart(
  props: ToolLatencyByToolNameChartProps,
) {
  const { startDate, endDate, baseTemplateId, timeRange } =
    useObservabilityContext();
  const { analysisLink, type = 'p50' } = props;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations(
    'pages/projects/observability/LLMLatencyByModelNameChart',
  );

  const { data } = webApi.observability.getLLMLatencyByModel.useQuery({
    queryKey: webApiQueryKeys.observability.getLLMLatencyByModel({
      projectId,
      startDate,
      endDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        projectId,
        startDate,
        endDate,
        baseTemplateId: baseTemplateId?.value,
        timeRange,
      },
    },
  });

  const { formatSmallDuration } = useFormatters();

  interface ToolSeriesData {
    date: string;
    latencyMs: number;
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
      if (!toolMap.has(item.modelName)) {
        toolMap.set(item.modelName, []);
      }
      toolMap.get(item.modelName)?.push({
        date: item.date,
        latencyMs: type === 'p50' ? item.p50LatencyMs : item.p99LatencyMs,
        name: item.modelName || '',
      });
    });

    // Convert to array and sort by average latency
    return Array.from(toolMap.entries()).map(([toolName, data]) => ({
      toolName,
      data,
    }));
  }, [data?.body.items, type]);

  const tableOptions = useObservabilitySeriesData<ToolSeriesData>({
    seriesData: toolSeries.map((tool) => ({
      data: tool.data,
      getterFn: (item) => item.latencyMs,
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
      info={t('info')}
      analysisLink={analysisLink}
      title={t('title', { type })}
      isLoading={!data}
      isEmpty={!data?.body.items?.length}
    >
      <Chart options={chartOptions} />
    </DashboardChartWrapper>
  );
}
