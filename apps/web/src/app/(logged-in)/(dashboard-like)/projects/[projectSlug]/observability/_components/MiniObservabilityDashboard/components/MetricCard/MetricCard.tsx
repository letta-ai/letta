'use client';
import React from 'react';
import {
  Card,
  Typography,
  HStack,
  VStack,
  Chart,
  Skeleton,
  InfoTooltip,
  Tooltip,
} from '@letta-cloud/ui-component-library';
import { cn } from '@letta-cloud/ui-styles';
import { ArrowUpIcon } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useViewportSize, useDebouncedValue } from '@mantine/hooks';
import type { EChartsOption } from 'echarts';

interface MetricCardProps {
  title: string;
  value?: string | number;
  trend?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
  chartData?: Array<{ x: string; y: number }>;
  className?: string;
  infoTooltip?: {
    text: string;
  };
  previousPeriodValue?: string | number;
  isInverted?: boolean;
  showRightBorder?: boolean;
  showBottomBorder?: boolean;
}

export function MetricCard(props: MetricCardProps) {
  const {
    title,
    value,
    trend,
    isLoading,
    chartData,
    className,
    infoTooltip,
    previousPeriodValue,
    isInverted,
    showRightBorder = true,
    showBottomBorder = true,
  } = props;

  const t = useTranslations('projects/(projectSlug)/page.MiniObservabilityDashboard.MetricCard');

  const { width = 0 } = useViewportSize();
  const [debouncedWidth] = useDebouncedValue(width, 100);

  const chartWidth = React.useMemo(() => {
    const width = debouncedWidth < 1300 ? 100 : 200;
    return width;
  }, [debouncedWidth]);

  const renderTrendIcon = () => {
    if (!trend || trend === 'neutral') return null;
    const rotation = trend === 'down' ? 'rotate-180' : '';
    const isGoodTrend = isInverted ? trend === 'down' : trend === 'up';
    const color = isGoodTrend ? 'hsl(var(--positive))' : 'hsl(var(--destructive))';
    return (
      <HStack align="center" justify="center" className={cn(rotation)} style={{ color }}>
        <ArrowUpIcon/>
      </HStack>
    );
  };

  const chartOptions = React.useMemo((): EChartsOption => {
    const safeChartData = chartData && chartData.length > 0 ? chartData : [{ x: '0', y: 0 }];
    const hasRealData = chartData && chartData.some(point => point.y > 0);

    const isGoodTrend = isInverted ? trend === 'down' : trend === 'up';
    const chartColor = hasRealData
      ? (isGoodTrend ? '#28A428' : trend === 'neutral' ? '#6B7280' : '#BA024C')
      : '#E5E7EB';

    return {
      // apache echarts styling
      grid: {
        left: 1,
        right: 1,
        top: 1,
        bottom: 1,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(17, 24, 39, 0.92)',
        borderColor: 'transparent',
        padding: 8,
        extraCssText:
          'box-shadow: 0 4px 16px rgba(0,0,0,0.25); border-radius: 8px;',
        textStyle: {
          color: '#fff',
          fontSize: 12,
          lineHeight: 18,
        },
        axisPointer: { type: 'line' },
        formatter: hasRealData ? (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;

          const rawLabel = p?.axisValueLabel ?? p?.name ?? '';
          let xLabel = rawLabel;
          try {
            const d = new Date(rawLabel);
            if (!isNaN(d.getTime())) {
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const h = d.getHours();
              const hh = h % 12 || 12;
              const mi = String(d.getMinutes()).padStart(2, '0');
              const ampm = h >= 12 ? 'PM' : 'AM';
              xLabel = `${mm}/${dd}, ${hh}:${mi} ${ampm}`;
            }
          } catch {
            // default
          }

          const valueRaw = Array.isArray(p?.value) ? p.value[1] : p?.value;
          const num =
            typeof valueRaw === 'number'
              ? valueRaw.toLocaleString()
              : String(valueRaw ?? '');

          const name = p?.seriesName || title || t('value');

          return `
            <div style="min-width:120px">
              <div style="font-weight:600;margin-bottom:4px;opacity:.9;">${xLabel}</div>
              <div style="display:flex;gap:6px;align-items:center;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p?.color};"></span>
                <span style="opacity:.85;">${name}</span>
                <span style="margin-left:auto;font-weight:600;">${num}</span>
              </div>
            </div>
          `;
        } : () => t('noDataAvailable'),
      },
      xAxis: {
        type: 'category' as const,
        show: false,
        data: safeChartData.map((item) => item.x),
      },
      yAxis: {
        type: 'value' as const,
        show: false,
      },
      series: [
        {
          name: title,
          data: safeChartData.map((item) => item.y),
          type: 'line',
          smooth: false,
          symbol: 'none',
          lineStyle: {
            width: 2.2,
            color: chartColor,
          },
          areaStyle: {
            opacity: hasRealData ? 0.2 : 0.05,
            color: chartColor,
          },
          emphasis: {
            lineStyle: {
              width: 2.2,
              color: chartColor,
            },
            areaStyle: {
              opacity: hasRealData ? 0.1 : 0.05,
              color: chartColor,
            },
          },
        },
      ],
    };
  }, [chartData, trend, isInverted, title, t]);

  return (
    <Card
      className={cn(
        'bg-background hover:bg-background-hover transition-colors border-0',
        showRightBorder && 'border-r border-background-grey3-border',
        showBottomBorder && 'border-b border-background-grey3-border',
        className,
      )}
    >
      <HStack justify="spaceBetween" align="center" fullWidth fullHeight>
        <VStack gap={null} align="start">
          <HStack gap="small" align="center">
            {isLoading ? (
              <Skeleton className="w-[60px] h-6" />
            ) : previousPeriodValue !== undefined ? (
              <Tooltip
                content={t('previousPeriod', { value: previousPeriodValue })}
                placement="top"
                asChild
              >
                <Typography
                  variant="heading4"
                  bold
                  align="left"
                  style={{
                    color:
                      trend === 'neutral'
                        ? undefined
                        : (isInverted ? trend === 'down' : trend === 'up')
                          ? 'hsl(var(--positive))'
                          : 'hsl(var(--destructive))',
                  }}
                >
                  {value ?? '--'}
                </Typography>
              </Tooltip>
            ) : (
              <Typography
                variant="heading4"
                bold
                align="left"
                style={{
                  color:
                    trend === 'neutral'
                      ? undefined
                      : (isInverted ? trend === 'down' : trend === 'up')
                        ? 'hsl(var(--positive))'
                        : 'hsl(var(--destructive))',
                }}
              >
                {value ?? '--'}
              </Typography>
            )}
            {renderTrendIcon()}
          </HStack>

          <HStack gap="small" align="center">
            <Typography variant="body2" color="muted" align="left">
              {title}
            </Typography>
            {infoTooltip && <InfoTooltip text={infoTooltip.text} />}
          </HStack>
        </VStack>

        <div className="w-30 h-[45px] flex items-center justify-center">
          {isLoading ? (
            <Skeleton className="w-[110px] h-[45px]" />
          ) : (
            <Chart key={chartWidth} options={chartOptions} width={chartWidth} height={45} />
          )}
        </div>
      </HStack>
    </Card>
  );
}
