'use client';
import * as React from 'react';
import type { EChartsOption } from 'echarts';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import { useDebouncedCallback } from '@mantine/hooks';
import './Chart.css';

interface ChartOptions {
  options: EChartsOption;
  showLegend?: boolean;
  height?: number;
  width?: number;
}

const defaultOptions: EChartsOption = {
  tooltip: {
    show: true,
  },
};

interface MakeFormattedTooltipOptions {
  value: string;
  label: string;
  color: string;
}

export function makeFormattedTooltip(options: MakeFormattedTooltipOptions) {
  const { value, label, color } = options;
  return `<div class="tooltip-format-container">
    <div class="tooltip-color" style="background-color: ${color}"></div>
    <div class="tooltip-value">${value}</div>
        <div class="tooltip-label">${label}</div>
</div>`;
}

export function Chart(props: ChartOptions) {
  const { options, width, height, showLegend } = props;
  const mounted = useRef(false);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const chartContainer = useRef<HTMLDivElement | null>(null);

  const resizeDebounce = useDebouncedCallback(() => {
    if (chart.current) {
      chart.current.resize();
    }
  }, 100);

  // re-render chart on resize of the parent container
  useEffect(() => {
    if (chartContainer.current) {
      const resizeObserver = new ResizeObserver(resizeDebounce);

      resizeObserver.observe(chartContainer.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [resizeDebounce]);

  useEffect(() => {
    if (mounted.current) {
      return;
    }

    if (chartRef.current) {
      if (!chart.current) {
        chart.current = echarts.init(chartRef.current);
      }

      chart.current.setOption({
        ...defaultOptions,
        ...options,
      });
      mounted.current = true;
    }

    return () => {
      mounted.current = false;
    };
  }, [options]);

  useEffect(() => {
    if (chart.current) {
      const currentChart = chart.current;

      currentChart.setOption({
        ...defaultOptions,
        ...options,
        tooltip: {
          borderWidth: 0,
          height: 28,
          padding: 0,
          trigger: 'item',
          position: 'top',
          backgroundColor: 'hsl(var(--background-grey2))',
          ...options.tooltip,
          className: 'chart-tooltip',
        },
        legend: {
          show: false,
        },
      });

      requestAnimationFrame(() => {
        currentChart.resize();
      });
    }
  }, [options]);

  return (
    <VStack ref={chartContainer} fullHeight fullWidth>
      <div
        ref={chartRef}
        className="w-full h-full"
        style={{ minWidth: width || '100%', minHeight: height || '100%' }}
      />
      {showLegend && Array.isArray(options?.series) && (
        <HStack wrap fullWidth>
          {options?.series?.map((series) => (
            <HStack align="center" key={series.name}>
              <div
                className="min-w-2 min-h-2"
                style={{
                  backgroundColor:
                    typeof series.color === 'string'
                      ? series.color
                      : series.color?.toString(),
                }}
              />
              <Typography variant="body3">{series.name}</Typography>
            </HStack>
          ))}
        </HStack>
      )}
    </VStack>
  );
}
