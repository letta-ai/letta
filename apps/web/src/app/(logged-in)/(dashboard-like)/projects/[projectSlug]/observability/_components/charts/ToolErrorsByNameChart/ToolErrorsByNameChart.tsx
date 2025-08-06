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
import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';

interface ToolErrorsByNameChartProps {
  analysisLink?: string;
}

export function ToolErrorsByNameChart(props: ToolErrorsByNameChartProps) {
  const { startDate, endDate, baseTemplateId, timeRange } =
    useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();

  const t = useTranslations(
    'pages/projects/observability/ToolErrorsByNameChart',
  );

  const { data } = webApi.observability.getToolErrorRateByName.useQuery({
    queryKey: webApiQueryKeys.observability.getToolErrorRateByName({
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

  const { formatNumber } = useFormatters();

  // Group data by tool name for multiple series
  interface ToolSeriesType {
    toolName: string;
    data: Array<{ date: string; errorCount: number }>;
    totalErrorCount: number;
  }
  const toolSeries: ToolSeriesType[] = useMemo(() => {
    if (!data?.body.items) return [];

    const toolMap = new Map<
      string,
      Array<{ date: string; errorCount: number }>
    >();

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
        errorCount: item.errorCount,
      });
    });

    // Convert to array and sort by total error count
    return Array.from(toolMap.entries())
      .map(([toolName, data]) => ({
        toolName,
        data,
        totalErrorCount: data.reduce((sum, item) => sum + item.errorCount, 0),
      }))
      .sort((a, b) => b.totalErrorCount - a.totalErrorCount);
  }, [data]);

  const tableOptions = useObservabilitySeriesData({
    seriesData: toolSeries.map((tool) => ({
      data: tool.data,
      getterFn: (item: any) => item.errorCount,
      defaultValue: 0,
    })) as any,
    startDate,
    endDate,
    formatter: function (value: number) {
      return formatNumber(value, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    },
  });

  // Customize options to add series names
  const chartOptions: Partial<EChartsOption> = useMemo(
    () => ({
      ...tableOptions,
      legend: {
        data: toolSeries.map((tool) => tool.toolName),
        bottom: 0,
        type: 'scroll',
      },
      series: (Array.isArray(tableOptions.series)
        ? tableOptions.series
        : []
      )?.map((series, index) => ({
        ...series,
        name: toolSeries[index]?.toolName || '',
      })),
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

          const options = e.map((param: any) => {
            return {
              color: param.color as string,
              label: param.seriesName,
              value: `${formatNumber(param.data.value, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })} errors`,
            };
          });

          return makeMultiValueFormattedTooltip({
            date,
            options,
          });
        },
      },
    }),
    [tableOptions, toolSeries, formatNumber],
  );

  return (
    <DashboardChartWrapper
      analysisLink={analysisLink}
      title={t('title')}
      isLoading={!data}
    >
      <Chart options={chartOptions} />
    </DashboardChartWrapper>
  );
}
