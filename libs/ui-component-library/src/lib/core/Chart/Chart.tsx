'use client';
import * as React from 'react';
import type { EChartsOption } from 'echarts';
import { useEffect, useMemo, useRef } from 'react';
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
  onInit?: (chart: echarts.ECharts) => void;
}

interface MakeFormattedTooltipOptions {
  value?: string;
  label: string;
  date?: string;
  color?: string;
}

const defaultOptions: EChartsOption = {
  tooltip: {
    show: true,
  },
};

interface MakeMultiValueFormattedTooltipOptions {
  options: MakeFormattedTooltipOptions[];
  date?: string;
}

export function makeMultiValueFormattedTooltip(
  options: MakeMultiValueFormattedTooltipOptions,
): string {
  const { options: tooltipOptions, date } = options;
  return `<div class="tooltip-multi-format-container">
          ${date ? `<div class="tooltip-date">${date}</div>` : ''}

    ${tooltipOptions
      .map(
        (option) => `<div class="tooltip-format-container">
          ${typeof option.color === 'string' ? `<div class="tooltip-color" style="background-color: ${option.color}"></div>` : ''}
          ${typeof option.value === 'string' ? `<div class="tooltip-value">${option.value}</div>` : ''}
          <div class="tooltip-label">${option.label}</div>
        </div>`,
      )
      .join('')}
</div>`;
}

export function generateFormatter(_formatFn: (value: string) => string) {
  return {};
}

export function makeFormattedTooltip(options: MakeFormattedTooltipOptions) {
  const { value, label, color } = options;
  return `<div class="tooltip-format-container-outer">
    ${options.date ? `<div class="tooltip-date">${options.date}</div>` : ''}
    <div class="tooltip-format-container">
     ${typeof color === 'string' ? `<div class="tooltip-color" style="background-color: ${color}"></div>` : ''}
    ${typeof value === 'string' ? `<div class="tooltip-value">${value}</div>` : ''}
        <div class="tooltip-label">${label}</div>
</div>
</div>`;
}

export function Chart(props: ChartOptions) {
  const { options, width, onInit, height, showLegend } = props;
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
      mounted.current = true;
      if (!chart.current) {
        chart.current = echarts.init(chartRef.current);
      }

      chart.current.setOption({
        ...defaultOptions,
        ...options,
      });

      if (onInit) {
        onInit(chart.current);
      }
    }
    //
    return () => {
      mounted.current = false;
    };
  }, [onInit, options]);

  const newOptions = useMemo(() => {
    return {
      ...defaultOptions,
      ...options,
      tooltip: {
        borderWidth: 0,
        height: 28,
        padding: 0,
        trigger: 'item',
        position: 'top',
        backgroundColor: 'hsl(var(--background-inverted))',
        ...options.tooltip,
        className: 'chart-tooltip',
      },
      legend: {
        show: false,
      },
    };
  }, [options]);

  useEffect(() => {
    if (chart.current) {
      const currentChart = chart.current;

      currentChart.setOption(newOptions, {
        silent: true,
        notMerge: true,
        lazyUpdate: true,
      });

      requestAnimationFrame(() => {
        currentChart.resize();
      });
    }
  }, [newOptions]);

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
                    typeof series.color === 'string' ? series.color : '',
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
