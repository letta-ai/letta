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
  makeFormattedTooltip,
} from '@letta-cloud/ui-component-library';
import { cn } from '@letta-cloud/ui-styles';
import { ArrowUpIcon } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { EChartsOption } from 'echarts';
import { useFormatters } from '@letta-cloud/utils-client';
import { useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';
import { useCurrentStyles } from '$web/client/hooks/useCurrentStyles/useCurrentStyles';

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
  } = props;

  const t = useTranslations('projects/(projectSlug)/page.MiniObservabilityDashboard.MetricCard');
  const { formatDate } = useFormatters();
  const { granularity } = useObservabilityContext();
  const styles = useCurrentStyles();

  const renderTrendIcon = () => {
    if (!trend || trend === 'neutral') return null;
    const rotation = trend === 'down' ? 'rotate-180' : '';
    return (
      <HStack align="center" justify="center" className={cn(rotation)}>
        <ArrowUpIcon color="default"/>
      </HStack>
    );
  };

  const chartOptions = React.useMemo((): EChartsOption => {
    const safeChartData = chartData && chartData.length > 0 ? chartData : [{ x: '0', y: 0 }];
    const hasRealData = chartData && chartData.some(point => point.y > 0);

    const chartColor = `hsl(${styles?.getPropertyValue('--brand')})`;

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
        formatter: hasRealData ? (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const rawDate = p?.axisValueLabel ?? p?.name ?? '';

          let formattedDate = rawDate;
          if (rawDate) {
            try {
              let date: Date;
              if (rawDate.includes(':')) {
                date = new Date(rawDate.endsWith('Z') ? rawDate : rawDate + 'Z');
              } else {
                date = new Date(rawDate + 'T00:00:00.000Z');
              }

              if (!isNaN(date.getTime())) {
                const formatOptions =
                  granularity.displayFormat === 'HH:mm'
                    ? {
                        hour: '2-digit' as const,
                        minute: '2-digit' as const,
                        timeZoneName: 'short' as const,
                      }
                    : {
                        month: 'short' as const,
                        day: 'numeric' as const,
                        timeZoneName: 'short' as const,
                      };
                formattedDate = formatDate(date, formatOptions);
              }
            } catch {
            }
          }

          const valueRaw = Array.isArray(p?.value) ? p.value[1] : p?.value;
          const value = typeof valueRaw === 'number'
            ? valueRaw.toLocaleString()
            : String(valueRaw ?? '');
          const label = p?.seriesName || title || t('value');

          return makeFormattedTooltip({
            date: formattedDate,
            value,
            label,
            color: p?.color,
          });
        } : () => makeFormattedTooltip({
          label: t('noDataAvailable'),
        }),
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
            width: 1.5,
            color: chartColor,
          },
          areaStyle: {
            opacity: hasRealData ? 0.1 : 0.05,
            color: chartColor,
          },
          emphasis: {
            lineStyle: {
              width: 2,
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
  }, [chartData, title, t, granularity, formatDate, styles]);

  return (
    <Card
      className={cn(
        'bg-project-card-background min-h-[90px] hover:bg-background-grey2 transition-colors border-0',
        className,
      )}
    >
      <HStack wrap justify="spaceBetween" align="center" fullWidth fullHeight>
        <VStack className="w-[110px]"  gap={null} align="start">
          {isLoading ? (
            <Skeleton className="w-[60px] h-6" />
          ) : previousPeriodValue !== undefined ? (
            <Tooltip
              content={t('previousPeriod', { value: previousPeriodValue })}
              placement="top"
              asChild
            >
              <HStack gap="small" align="center">
                <Typography
                  variant="heading4"
                  bold
                  align="left"
                  color="default"
                >
                  {value ?? '--'}
                </Typography>
                {renderTrendIcon()}
              </HStack>
            </Tooltip>
          ) : (
            <HStack gap="small" align="center">
              <Typography
                variant="heading4"
                bold
                align="left"
                color="default"
              >
                {value ?? '--'}
              </Typography>
              {renderTrendIcon()}
            </HStack>
          )}
          <HStack gap="small" align="center">
            <Typography variant="body2" color="muted" align="left">
              {title}
            </Typography>
            {infoTooltip && <InfoTooltip text={infoTooltip.text} />}
          </HStack>
        </VStack>
        <div className="min-w-[30px]  flex-1 h-[45px] flex items-center justify-center">
          {isLoading ? (
            <Skeleton className="w-full h-[45px]" />
          ) : (
            <Chart  options={chartOptions}  height={45} />
          )}
        </div>
      </HStack>
    </Card>
  );
}
