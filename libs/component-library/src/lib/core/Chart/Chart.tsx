'use client';
import * as React from 'react';
import type { EChartsOption } from 'echarts';
import { useEffect } from 'react';
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
  const chartRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartRef.current) {
      const chart = echarts.init(chartRef.current);
      chart.setOption({
        ...defaultOptions,
        ...options,
      });

      requestAnimationFrame(() => {
        chart.resize();
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
