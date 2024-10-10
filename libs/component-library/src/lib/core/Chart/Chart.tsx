'use client';
import * as React from 'react';
import type { EChartsOption } from 'echarts';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface ChartOptions {
  options: EChartsOption;
}

const defaultOptions: EChartsOption = {
  tooltip: {
    show: true,
  },
};

export function Chart(props: ChartOptions) {
  const { options } = props;
  const mounted = useRef(false);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (mounted.current) {
      return;
    }

    if (chartRef.current) {
      chart.current = echarts.init(chartRef.current);
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
      });

      requestAnimationFrame(() => {
        currentChart.resize();
      });
    }
  }, [options]);

  return (
    <div
      ref={chartRef}
      className="w-full h-full"
      style={{ minWidth: '100%', minHeight: '100%' }}
    />
  );
}
